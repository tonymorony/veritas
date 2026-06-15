import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Problem } from "./components/Problem";
import { Mechanism } from "./components/Mechanism";
import { Collusion } from "./components/Collusion";
import { Artifact } from "./components/Artifact";
import { BuiltOn } from "./components/BuiltOn";
import { FinalCTA } from "./components/FinalCTA";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <div className="relative min-h-screen bg-ink text-fg">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Mechanism />
        <Collusion />
        <Artifact />
        <BuiltOn />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
