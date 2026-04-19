

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";

import type {
  FrontOfficeAppointmentBridgeAction,
  FrontOfficeAppointmentExternalWorkflowStatus,
  FrontOfficeAppointmentsSnapshot,
} from "@acre/db";

import {
  Badge,
  Button,
  EmptyState,
  FormField,
  QueueItem,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";

import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";

import { FrontOfficeLink } from "../../_components/front-office-link";

import { useI18n } from "../../../../lib/i18n/client";

import {
  calendarViewValues,
  deriveCalendarViewFromRoute,
  getCalendarViewForWritebackReentry,
  getCalendarViewConfig,
  getCalendarViewRoutePatch,
  resolveCalendarView,
  type CalendarViewKey,
} from "../calendar-view";

export type FrontOfficeCalendarClientProps = {
  initialClientId?: string;
  initialListingId?: string;
  snapshot: FrontOfficeAppointmentsSnapshot;
  timeZone?: string | null;
};



export type AppointmentTouchPreset =
  FrontOfficeCalendarClientProps["snapshot"]["appointments"][number]["touchPresets"][number];



export type AppointmentFormState = {
  title: string;
  type: string;
  clientId: string;
  listingId: string;
  startsAt: string;
  endsAt: string;
  location: string;
  meetingUrl: string;
  contactLabel: string;
  notes: string;
};



export type AppointmentWritebackDraft = {
  status: FrontOfficeAppointmentExternalWorkflowStatus;
  note: string;
  nextActionAt: string;
};



export type FeedbackState = {
  tone: "success" | "error";
  message: string;
  actionHref?: string;
  actionLabel?: string;
} | null;



export type BridgeActionResponse = {
  action: FrontOfficeAppointmentBridgeAction;
  actionLabel: string;
  checkpoint: FrontOfficeAppointmentCheckpointSummary;
  continuity?: FrontOfficeAppointmentCheckpointSummary & {
    returnToLabel: string;
    returnToDetail: string;
  };
  manualOnlyDetail?: string;
  followUpDetail?: string;
  followUpCadenceLabel?: string;
  followUpCadenceDetail?: string;
  suggestedWriteback?: {
    status: FrontOfficeAppointmentExternalWorkflowStatus;
    label: string;
    detail: string;
    nextActionAtLabel: string;
    nextActionAtValue: string;
  } | null;
  result:
    | {
        kind: "redirect";
        href: string;
      }
    | {
        kind: "calendar_export";
        fileName: string;
        content: string;
      };
  error?: string;
  hint?: string;
};



export type AppointmentMailThreadSuccessResponse = {
  thread: {
    id: string;
    subject: string;
  };
  threadHref: string;
  actionLabel: string;
  actionTargetLabel: string | null;
  actionTargetUrl: string | null;
  manualOnlyDetail: string;
  continuity: FrontOfficeAppointmentCheckpointSummary & {
    returnToLabel: string;
    returnToDetail: string;
    returnToUrl: string | null;
  };
  error?: never;
  hint?: never;
};



export type AppointmentMailThreadErrorResponse = {
  error: string;
  hint?: string;
  thread?: never;
  threadHref?: never;
  actionLabel?: never;
  manualOnlyDetail?: never;
  continuity?: never;
};



export type AppointmentMailThreadResponse =
  | AppointmentMailThreadSuccessResponse
  | AppointmentMailThreadErrorResponse
  | null;



export type FrontOfficeAppointmentCheckpointSummary = {
  label: string;
  detail: string;
  nextStep: string;
  sourceNote: string;
};



export type BridgeOutcomeState = {
  appointmentId: string;
  actionLabel: string;
  manualOnlyDetail: string;
  followUpDetail: string;
  followUpCadenceLabel: string;
  followUpCadenceDetail: string;
  resultKind: BridgeActionResponse["result"]["kind"];
  checkpoint: FrontOfficeAppointmentCheckpointSummary;
  continuity: BridgeActionResponse["continuity"] | null;
  suggestedWriteback: BridgeActionResponse["suggestedWriteback"];
};



export type AppointmentMutationResponse = {
  appointment?: {
    id: string;
    title?: string;
  };
  checkpoint?: FrontOfficeAppointmentCheckpointSummary;
  continuity?: FrontOfficeAppointmentCheckpointSummary & {
    returnToLabel: string;
    returnToDetail: string;
  };
  error?: string;
  hint?: string;
} | null;



export type AppointmentCue = {
  label: string;
  tone: "neutral" | "accent" | "success" | "warning" | "danger";
};



export type FilterState = {
  clientId: string;
  calendarView: CalendarViewKey;
  listingId: string;
  type: string;
  status: string;
  coordination: string;
  followUp: string;
  appointmentId: string;
  returnTo: string;
};



export type FilterUpdate = Partial<FilterState>;



export type FocusState =
  | {
      mode: "default" | "locked_in_queue" | "locked_outside_queue";
      appointment: FrontOfficeAppointmentsSnapshot["appointments"][number];
    }
  | {
      mode: "missing" | "empty";
      appointment: null;
    };



export type AgendaSection = {
  dateKey: string;
  label: string;
  isToday: boolean;
  isTomorrow: boolean;
  appointments: FrontOfficeAppointmentsSnapshot["appointments"];
};
