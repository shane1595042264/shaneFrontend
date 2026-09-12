"use client";

import { AuthorOnly } from "@/components/blog/author-only";
import { PostEditor } from "@/components/blog/post-editor";

// Client-rendered on purpose: the compose form is auth-gated, and a Server
// Component cannot see the JWT (it lives in localStorage), so any server-side
// read of an authed endpoint would 401 on every request.
export default function NewBlogPostPage() {
  return (
    <AuthorOnly>
      <PostEditor existing={null} />
    </AuthorOnly>
  );
}
