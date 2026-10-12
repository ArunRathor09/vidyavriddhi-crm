export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Nexora CRM. All rights reserved.</p>
        <p>Customers. Leads. Sales. Teams. Analytics.</p>
      </div>
    </footer>
  );
}