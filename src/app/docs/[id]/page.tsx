import { DocumentEditorView } from "@/components/DocumentEditorView";

interface DocumentPageProps {
  params: Promise<{ id: string }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { id } = await params;
  return <DocumentEditorView documentId={id} />;
}
