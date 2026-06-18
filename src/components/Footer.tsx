export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40 mt-16">
      <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground text-center">
        © {new Date().getFullYear()} Liga Acadêmica de Pediatria — Unioeste. Todos os direitos reservados.
      </div>
    </footer>
  );
}
