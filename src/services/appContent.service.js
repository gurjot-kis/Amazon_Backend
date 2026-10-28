import Store from "../models/store.model.js";
import { AppError } from "../utils/AppError.js";

const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const assertObjectId = (value, name) => {
  if (!OBJECT_ID_REGEX.test(String(value ?? ""))) {
    throw new AppError(400, `${name} must be a valid ObjectId`);
  }
};

export const AppContentService = {
  getStoreContactAndTimings: async (storeId) => {
    assertObjectId(storeId, "store ID");

    const store = await Store.findOne(
      { _id: storeId, status: "active" },
      { store_logo: 1, email: 1, phone: 1, timings: 1 },
    ).lean();

    if (!store) throw new Error("Store not found");

    // Convert HH:MM (24h) → h:MM AM/PM
    const to12h = (time) => {
      if (!time) return "";
      const [h, m] = time.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      const hour = h % 12 || 12;
      return `${hour}:${String(m).padStart(2, "0")} ${period}`;
    };

    const DAY_SHORT = {
      monday: "Mon",
      tuesday: "Tue",
      wednesday: "Wed",
      thursday: "Thu",
      friday: "Fri",
      saturday: "Sat",
      sunday: "Sun",
    };

    // Group consecutive days with same open/close time into ranges
    const formatTimings = (timings = []) => {
      if (!timings.length) return [];

      // Sort by week order first
      const ORDER = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
      const sorted = [...timings].sort(
        (a, b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day),
      );

      const groups = [];
      let group = null;

      for (const t of sorted) {
        const key = t.is_closed ? "closed" : `${t.open_time}-${t.close_time}`;

        if (group && group.key === key) {
          // Extend current group
          group.end = t.day;
        } else {
          // Start new group
          group = { key, start: t.day, end: t.day, timing: t };
          groups.push(group);
        }
      }

      return groups.map(({ start, end, timing }) => {
        const dayLabel =
          start === end
            ? DAY_SHORT[start]
            : `${DAY_SHORT[start]} - ${DAY_SHORT[end]}`;

        if (timing.is_closed) {
          return { days: dayLabel, hours: "Closed" };
        }

        return {
          days: dayLabel,
          hours: `${to12h(timing.open_time)} - ${to12h(timing.close_time)}`,
        };
      });
    };

    return {
      _id: store._id,
      store_logo: store.store_logo,
      email: store.email,
      phone: store.phone,
      timings: formatTimings(store.timings),
    };
  },
};

export default AppContentService;
