// app/creators/[creatorId]/page.tsx (Server Component - no "use client")
import CreatorContentPage from '@/components/CreatorContentPage';

type Props = {
  params: Promise<{ creatorId: string }>;
};

export default async function Page(props: Props) {
  const params = await props.params;
  
  return <CreatorContentPage creatorId={params.creatorId} />;
}