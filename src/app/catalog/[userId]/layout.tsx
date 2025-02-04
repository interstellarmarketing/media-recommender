interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}

export default async function CatalogLayout({ children, params }: LayoutProps) {
  // Ensure params are resolved before rendering children
  const resolvedParams = await params;
  
  return (
    <section>
      {children}
    </section>
  );
} 