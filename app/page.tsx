import { redirect } from "next/navigation";

export default function Home() {
  // The product is the dashboard; there is no separate landing page.
  redirect("/dashboard");
}
