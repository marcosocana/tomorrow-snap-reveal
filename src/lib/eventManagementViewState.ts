export type EventManagementProduct = "revelao" | "captains" | "capsule" | "photostrip";
export type EventManagementAdminTab = "new" | "upcoming" | "past" | "tests" | "others";
export type EventManagementView = "list" | "calendar";
export type CaptainsStatusFilter = "all" | "in_progress" | "finished";
export type CapsuleStatusFilter = "all" | "pending" | "in_progress" | "past";
export type AdminTypeFilter = "all" | "Demo" | "Start" | "Plus" | "Pro";
export type AdminPhoneFilter = "all" | "yes" | "no";
export type AdminSort = {
  key: "name" | "type" | "start" | "creation" | "email" | "photos";
  direction: "asc" | "desc";
};

export type EventManagementViewState = {
  activeProduct: EventManagementProduct;
  adminSearch: string;
  adminTypeFilter: AdminTypeFilter;
  adminPhoneFilter: AdminPhoneFilter;
  adminActiveTab: EventManagementAdminTab;
  adminSort: AdminSort;
  adminPage: number;
  adminPageSize: number | "all";
  adminView: EventManagementView;
  captainsStatusFilter: CaptainsStatusFilter;
  capsuleStatusFilter: CapsuleStatusFilter;
};

export const CAPTAINS_EVENT_MANAGEMENT_VIEW: EventManagementViewState = {
  activeProduct: "captains",
  adminSearch: "",
  adminTypeFilter: "all",
  adminPhoneFilter: "all",
  adminActiveTab: "others",
  adminSort: { key: "start", direction: "desc" },
  adminPage: 1,
  adminPageSize: 30,
  adminView: "list",
  captainsStatusFilter: "all",
  capsuleStatusFilter: "all",
};

const RETURN_VIEW_KEY = "event-management:return-view";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object");

export const eventManagementViewFromLocationState = (state: unknown): EventManagementViewState | null => {
  if (!isRecord(state) || !isRecord(state.eventManagementView)) return null;
  return { ...CAPTAINS_EVENT_MANAGEMENT_VIEW, ...state.eventManagementView } as EventManagementViewState;
};

export const saveEventManagementReturnView = (view: EventManagementViewState) => {
  try {
    sessionStorage.setItem(RETURN_VIEW_KEY, JSON.stringify(view));
  } catch {
    // Location state still preserves the return view when storage is unavailable.
  }
};

export const takeEventManagementReturnView = (): EventManagementViewState | null => {
  try {
    const stored = sessionStorage.getItem(RETURN_VIEW_KEY);
    sessionStorage.removeItem(RETURN_VIEW_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return isRecord(parsed) ? { ...CAPTAINS_EVENT_MANAGEMENT_VIEW, ...parsed } as EventManagementViewState : null;
  } catch {
    return null;
  }
};
