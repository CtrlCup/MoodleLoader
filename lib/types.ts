export type ConflictAction = 'replace' | 'copy' | 'skip';
export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  /** Unterordnername relativ zum Standard-Downloads-Ordner des Browsers. */
  baseFolder: string;
  conflictAction: ConflictAction;
  saveCourseAsHtml: boolean;
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  baseFolder: 'Moodle',
  conflictAction: 'copy',
  saveCourseAsHtml: true,
  theme: 'system',
};

/** Ein einzelnes herunterzuladendes Element, wie es der Content-Script-Scan liefert. */
export interface DiscoveredFile {
  /** Direkte oder in eine direkte Download-URL umgewandelte URL. */
  url: string;
  /** Vorgeschlagener Dateiname inkl. Endung, noch ohne Ordnerpfad. */
  filename: string;
  /** Ordnerpfade relativ zum Kursordner, z. B. ['Übungen', 'Übung 4']. */
  subPath: string[];
  /** Woher die Datei stammt, nur für UI/Logging. */
  source:
    | 'resource'
    | 'folder'
    | 'assign-intro'
    | 'assign-submission'
    | 'external-cloud'
    | 'course-html';
}

export interface ScanResult {
  courseId: string | null;
  courseName: string;
  files: DiscoveredFile[];
  warnings: string[];
}

export type PageKind = 'course' | 'dashboard' | 'other';

export interface DashboardCourseLink {
  id: string;
  name: string;
  url: string;
}

export interface DownloadProgress {
  total: number;
  done: number;
  failed: number;
  skipped: number;
  currentFile?: string;
  finished: boolean;
}

/** Nachrichten Popup -> Content-Script */
export type ContentRequest =
  | { type: 'moodleloader:detect' }
  | { type: 'moodleloader:scan'; saveCourseAsHtml: boolean; courseUrl?: string };

/** Antworten Content-Script -> Popup */
export interface DetectResponse {
  isMoodle: boolean;
  pageKind: PageKind;
  courseName?: string;
  dashboardCourses?: DashboardCourseLink[];
}

export type ScanResponse = ScanResult;

export interface CourseTarget {
  name: string;
  /** URL des Kurses, falls nicht die aktuell aktive Tab-Seite gemeint ist. */
  url?: string;
}

/** Nachrichten Popup -> Background. Die gesamte Mehrkurs-Orchestrierung läuft im Hintergrund,
 * damit sie unabhängig von der Lebensdauer des Popups weiterläuft (Popups werden vom Browser
 * zerstört, sobald sie den Fokus verlieren). */
export type BackgroundRequest = {
  type: 'moodleloader:download-batch';
  tabId: number;
  courses: CourseTarget[];
  saveCourseAsHtml: boolean;
};

/** Broadcast Background -> Popup */
export interface ProgressMessage {
  type: 'moodleloader:progress';
  state: DownloadRunState;
}

/** Im Hintergrund persistierter/gesendeter Zustand für einen (Mehrfach-)Kurs-Download-Lauf. */
export interface DownloadRunState {
  courseIndex: number;
  totalCourses: number;
  courseLabel: string;
  fileProgress: DownloadProgress;
  finished: boolean;
  totals: { done: number; failed: number; skipped: number };
  warningsByCourse: [string, string[]][];
  updatedAt: number;
}
