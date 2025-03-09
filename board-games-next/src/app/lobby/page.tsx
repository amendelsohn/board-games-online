import Lobby from "@/components/lobby/Lobby";

export default function LobbyPage({
  searchParams,
}: {
  searchParams: { gameType?: string };
}) {
  return <Lobby initialGameType={searchParams.gameType} />;
}
