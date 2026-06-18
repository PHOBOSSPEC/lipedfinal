export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40 mt-16">
      <div className="container mx-auto px-4 py-8 text-sm text-muted-foreground text-center">
        <p>© {new Date().getFullYear()} Liga Acadêmica de Pediatria — Unioeste. Todos os direitos reservados.</p>
        <p className="text-xs mt-2 opacity-80">Desenvolvido por Mateus SB em 2026</p>
      </div>
    </footer>
  );
}
