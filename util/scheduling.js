export function getPresetWindow(preset, date) {
  const d = new Date(date);

  if (preset === "morning") {
    return {
      start: new Date(d.setHours(9, 0, 0, 0)),
      end: new Date(d.setHours(12, 0, 0, 0)),
    };
  }

  if (preset === "midday") {
    return {
      start: new Date(d.setHours(12, 0, 0, 0)),
      end: new Date(d.setHours(15, 0, 0, 0)),
    };
  }

  if (preset === "afternoon") {
    return {
      start: new Date(d.setHours(15, 0, 0, 0)),
      end: new Date(d.setHours(17, 0, 0, 0)),
    };
  }

  return null;
}