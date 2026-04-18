import { NextResponse } from "next/server";
import { z, type ZodError, type ZodType } from "zod";

export type ApiFieldErrorMap = Record<string, string>;

type ParseSuccess<T> = {
  ok: true;
  data: T;
};

type ParseFailure = {
  ok: false;
  fieldErrors: ApiFieldErrorMap;
  response: NextResponse;
};

export type ParsedBodyResult<T> = ParseSuccess<T> | ParseFailure;

type ParseSchemaOptions = {
  error?: string;
  invalidJsonError?: string;
};

function formatIssuePath(path: ReadonlyArray<PropertyKey>) {
  if (path.length === 0) {
    return "body";
  }

  let formatted = "";

  for (const [index, segment] of path.entries()) {
    if (typeof segment === "symbol") {
      const symbolLabel = String(segment);
      formatted = index === 0 ? symbolLabel : `${formatted}.${symbolLabel}`;
      continue;
    }

    if (typeof segment === "number") {
      formatted = `${formatted}[${segment}]`;
      continue;
    }

    if (index === 0) {
      formatted = segment;
      continue;
    }

    formatted = `${formatted}.${segment}`;
  }

  return formatted || "body";
}

export function flattenZodFieldErrors(error: ZodError): ApiFieldErrorMap {
  const fieldErrors: ApiFieldErrorMap = {};

  for (const issue of error.issues) {
    const key = formatIssuePath(issue.path);

    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  if (Object.keys(fieldErrors).length === 0) {
    fieldErrors.body = "Request validation failed.";
  }

  return fieldErrors;
}

export function buildValidationErrorResponse(
  fieldErrors: ApiFieldErrorMap,
  error = Object.values(fieldErrors)[0] ?? "Request validation failed."
) {
  return NextResponse.json(
    {
      error,
      errorCode: "validation_error",
      fieldErrors,
    },
    { status: 400 },
  );
}

function parseSchema<TSchema extends ZodType>(
  payload: unknown,
  schema: TSchema,
  options: ParseSchemaOptions = {},
): ParsedBodyResult<z.infer<TSchema>> {
  const parsed = schema.safeParse(payload);

  if (parsed.success) {
    return {
      ok: true,
      data: parsed.data,
    };
  }

  const fieldErrors = flattenZodFieldErrors(parsed.error);

  return {
    ok: false,
    fieldErrors,
    response: buildValidationErrorResponse(fieldErrors, options.error),
  };
}

function formDataToObject(formData: FormData) {
  const data: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};

  for (const [key, value] of formData.entries()) {
    const existing = data[key];

    if (existing === undefined) {
      data[key] = value;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(value);
      continue;
    }

    data[key] = [existing, value];
  }

  return data;
}

export async function parseJsonBody<TSchema extends ZodType>(
  request: Request,
  schema: TSchema,
  options: ParseSchemaOptions = {},
): Promise<ParsedBodyResult<z.infer<TSchema>>> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    const invalidJsonError =
      options.invalidJsonError ?? "Request body must be valid JSON.";

    return {
      ok: false,
      fieldErrors: {
        body: invalidJsonError,
      },
      response: buildValidationErrorResponse(
        {
          body: invalidJsonError,
        },
        invalidJsonError,
      ),
    };
  }

  return parseSchema(payload, schema, options);
}

export function parseFormData<TSchema extends ZodType>(
  formData: FormData,
  schema: TSchema,
  options: ParseSchemaOptions = {},
): ParsedBodyResult<z.infer<TSchema>> {
  return parseSchema(formDataToObject(formData), schema, options);
}
