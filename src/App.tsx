import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./myComponents/Dashboard";
import BrowserAutomation from "./myComponents/BrowserAutomation";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BrowserAutomation />} />
      </Routes>
    </Router>
  );
}

export default App;
