import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, Shield, Menu, X } from "lucide-react";
import { useState } from "react";
const logoUrl = "/liped-logo.png";

import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/db";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const linkBase = "px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-secondary";
  const activeProps = { className: "px-3 py-2 text-sm font-semibold rounded-md bg-secondary text-primary" };

  const links = (
    <>
      <Link to="/" activeOptions={{ exact: true }} className={linkBase} activeProps={activeProps} onClick={() => setOpen(false)}>Início</Link>
      <Link to="/eventos" className={linkBase} activeProps={activeProps} onClick={() => setOpen(false)}>Eventos</Link>
      <Link to="/trabalhos" className={linkBase} activeProps={activeProps} onClick={() => setOpen(false)}>Trabalhos</Link>
      <Link to="/coppa" className="px-3 py-2 text-sm font-semibold rounded-md bg-accent text-accent-foreground hover:opacity-90 transition" onClick={() => setOpen(false)}>III COPPA</Link>
      {isAdmin && (
        <Link to="/admin" className={linkBase} activeProps={activeProps} onClick={() => setOpen(false)}>
          <Shield className="inline h-4 w-4 mr-1" />Admin
        </Link>
      )}
      {!user ? (
        <Link to="/login" className={linkBase} onClick={() => setOpen(false)}>
          <LogIn className="inline h-4 w-4 mr-1" />Entrar
        </Link>
      ) : (
        <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); setOpen(false); navigate({ to: "/" }); }}>
          Sair
        </Button>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-primary" onClick={() => setOpen(false)}>
          <img src={logoUrl} alt="LIPED" className="h-10 w-10 object-contain rounded-full bg-primary/15 ring-2 ring-primary/40 p-1" />
          <span className="font-bold tracking-tight text-sm md:text-base">LIPED · Unioeste</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">{links}</nav>
        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="md:hidden border-t border-border bg-background flex flex-col gap-1 p-3">
          {links}
        </nav>
      )}
    </header>
  );
}
