import { CategoryFormDialog } from "@/components/category-form";
import { CategoryList } from "@/components/category-list";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types";

export default async function CategoriesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, type, sort_order")
    .order("type")
    .order("sort_order")
    // Two categories can share a sort_order after a concurrent insert, so order
    // by id as well to keep the list stable between renders.
    .order("id");

  const categories: Category[] = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Add, rename or delete your own categories. Type cannot be changed
            after creation.
          </p>
        </div>

        <CategoryFormDialog trigger={<Button>Add category</Button>} />
      </div>

      {error ? (
        <p className="text-destructive text-sm">
          Could not load your categories. Please refresh the page.
        </p>
      ) : (
        <CategoryList categories={categories} />
      )}
    </div>
  );
}
