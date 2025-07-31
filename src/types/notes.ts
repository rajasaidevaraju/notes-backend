export interface NoteRow {
  id: number;
  title: string;
  content: string | null;
  createdAt: string;
  updatedAt:string;
  hidden: number;
  pinned: number;
}