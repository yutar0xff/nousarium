export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}
