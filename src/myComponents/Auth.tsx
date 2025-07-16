import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    console.log("Handling auth for:", isLogin ? "login" : "signup");
    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);

    console.log("Auth response:", error ? error.message : "Success");
  };

  return (
    <div className="p-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="border p-2"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="border p-2"
      />
      <button
        onClick={handleAuth}
        className="bg-blue-500 hover:bg-blue-700 text-white p-2"
      >
        {isLogin ? "Login" : "Signup"}
      </button>
      <button onClick={() => setIsLogin(!isLogin)} className="ml-2">
        {isLogin ? "Switch to Signup" : "Switch to Login"}
      </button>
    </div>
  );
}
