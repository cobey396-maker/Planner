import type { Metadata } from "next";
import { FriendsScreen } from "@/components/screens/friends-screen";

export const metadata: Metadata = { title: "Friends" };

export default function FriendsPage() {
  return <FriendsScreen />;
}
