"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCategory } from "@/app/dashboard/categories/actions";
import { CategoryFormDialog } from "@/components/category-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Category } from "@/lib/types";

function CategoryRow({ category }: { category: Category }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isIncome = category.type === "income";

  function onDelete() {
    startTransition(async () => {
      const result = await deleteCategory(category.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Category deleted");
      setConfirmOpen(false);
    });
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{category.name}</TableCell>

      <TableCell>
        <Badge variant={isIncome ? "secondary" : "outline"}>
          {isIncome ? "Income" : "Expense"}
        </Badge>
      </TableCell>

      <TableCell>
        <div className="flex justify-end gap-1">
          <CategoryFormDialog
            category={category}
            trigger={
              <Button variant="ghost" size="sm">
                Rename
              </Button>
            }
          />

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive">
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this category?</AlertDialogTitle>
                <AlertDialogDescription>
                  {category.name} will be permanently removed. Transactions
                  filed under it must be moved or deleted first, and this cannot
                  be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pending}
                  onClick={(event) => {
                    event.preventDefault();
                    onDelete();
                  }}
                >
                  {pending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CategoryList({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-12 text-center text-sm">
        No categories yet. Add one to start grouping your transactions.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-32">Type</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
