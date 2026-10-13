"use client";

import type { ReactNode } from "react";

export function DeleteEntryForm({
  action,
  children = "Delete",
}: {
  action: (formData: FormData) => Promise<void>;
  children?: ReactNode;
}) {
  return (
    <form action={action} onSubmit={(event) => {
      if (!window.confirm("Delete this entry? This change cannot be undone.")) event.preventDefault();
    }}>
      {children}
    </form>
  );
}
