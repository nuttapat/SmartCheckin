# Light-Blue Theme Reference Design

This document serves as the project's visual and UI design reference for the **light-blue theme**.

## Color Palette & Theme Tokens
- **Primary Accent**: Sky Blue (`sky-600`, `sky-500`, `sky-400`)
- **Backgrounds**:
  - Light Mode: Crisp off-white and soft slate (`bg-white`, `bg-slate-50`, `bg-slate-100/80`)
  - Dark Mode: Deep slate and dark navy (`bg-slate-950`, `bg-slate-900`, `bg-slate-800/80`)
- **Borders**: Thin, high-contrast borders (`border-slate-200` in light mode, `border-slate-800` / `border-slate-700` in dark mode)
- **Status Badges**:
  - Active/Info/Selected: Sky Blue (`bg-sky-500/10`, `text-sky-600 dark:text-sky-400`, `border-sky-500/20`)
  - Success/Present: Emerald Green (`bg-emerald-500/10`, `text-emerald-600 dark:text-emerald-400`, `border-emerald-500/20`)
  - Warning/Leave: Amber Yellow (`bg-amber-500/10`, `text-amber-600 dark:text-amber-400`, `border-amber-500/20`)
  - Danger/Absent: Rose Red (`bg-rose-500/10`, `text-rose-600 dark:text-rose-400`, `border-rose-500/20`)

## Layout & Components Style
- **Modals & Cards**:
  - Corner Radius: `rounded-2xl` for cards, modals, and container wrappers.
  - Backdrop: `backdrop-blur-sm` overlay for modals.
  - Padding: Spacious and proportional (`p-4 sm:p-6`).
- **Buttons & Controls**:
  - Primary Action: `bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl` with soft blue drop shadow (`shadow-md shadow-sky-600/20 active:scale-95`).
  - Secondary/Tab Action: Pill or rounded-2xl tabs with smooth transitions.
- **Typography**:
  - Clean sans-serif hierarchy, heavy bold/black headings (`font-extrabold`, `font-black`), concise field labels (`text-xs font-bold`).
