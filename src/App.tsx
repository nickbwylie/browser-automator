import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Auth from "./myComponents/Auth";
import Dashboard from "./myComponents/Dashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
