// Folder icon and text colors for visual organization
// Each color pair provides a complementary icon and text color
const FOLDER_COLORS = [
  { icon: "text-chart-1", text: "text-chart-1" }, // Red
  { icon: "text-chart-2", text: "text-chart-2" }, // Blue
  { icon: "text-chart-3", text: "text-chart-3" }, // Green
  { icon: "text-chart-4", text: "text-chart-4" }, // Orange
  { icon: "text-chart-5", text: "text-chart-5" }, // Purple
  { icon: "text-amber-500", text: "text-amber-500" }, // Amber
  { icon: "text-pink-500", text: "text-pink-500" }, // Pink
  { icon: "text-cyan-500", text: "text-cyan-500" }, // Cyan
]

export function getFolderColor(index: number) {
  return FOLDER_COLORS[index % FOLDER_COLORS.length]
}

export function getFolderColors(index: number) {
  const color = getFolderColor(index)
  return {
    icon: color.icon,
    text: color.text,
  }
}
