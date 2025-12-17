import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { MatchPage } from "./pages/MatchPage";
import { GalleryPage } from "./pages/GalleryPage";
import { JudgingPage } from "./pages/JudgingPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/match/:matchId" element={<MatchPage />} />
        <Route path="/match/:matchId/gallery" element={<GalleryPage />} />
        <Route path="/match/:matchId/judging" element={<JudgingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
