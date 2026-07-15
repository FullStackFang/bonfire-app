import { redirect } from "next/navigation";

// The dash is the front door of the app (owner call, add-pulse-dashboard task 4.2).
// The map prototype (components/map/MapView) is parked, not deleted.
export default function Home() {
  redirect("/p");
}
