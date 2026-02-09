import ClientPage from "./client-page";

export const dynamicParams = true;

export function generateStaticParams() {
  return [{ id: [] }];
}

export default function Page({ params }: { params: Promise<{ id?: string[] }> }) {
  return <ClientPage params={params} />;
}