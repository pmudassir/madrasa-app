"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, ArrowRight, GraduationCap } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [madrasaName, setMadrasaName] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      setError(authError?.message || "Sign up failed");
      setLoading(false);
      return;
    }

    // 2. Create the madrasa
    const { data: madrasa, error: madrasaError } = await supabase
      .from("madrasas")
      .insert({ name: madrasaName })
      .select()
      .single();

    if (madrasaError || !madrasa) {
      setError(madrasaError?.message || "Failed to create madrasa");
      setLoading(false);
      return;
    }

    // 3. Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      madrasa_id: madrasa.id,
      full_name: fullName,
      role: "admin",
    });

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#f0fdf4] flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-[#e2e8f0] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1e293b] rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#00c853]" />
          </div>
          <span className="font-bold text-[#1e293b] text-lg">Madrasa Manager</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* Logo circle */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center border-2 border-[#e8faf0]">
              <GraduationCap className="w-8 h-8 text-[#00c853]" />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#e2e8f0] p-8">
            <h1 className="text-2xl font-bold text-center text-[#1e293b] mb-1">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-center text-[#64748b] text-sm mb-8">
              {isSignUp
                ? "Register your madrasa and start managing"
                : "Sign in to manage your students and staff"}
            </p>

            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {isSignUp && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      required
                      className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/30 focus:border-[#00c853] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Madrasa Name</label>
                    <input
                      type="text"
                      value={madrasaName}
                      onChange={(e) => setMadrasaName(e.target.value)}
                      placeholder="Name of your madrasa"
                      required
                      className="w-full px-4 py-3 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/30 focus:border-[#00c853] transition"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@madrasa.com"
                    required
                    className="w-full pl-10 pr-4 py-3 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/30 focus:border-[#00c853] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 border border-[#e2e8f0] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00c853]/30 focus:border-[#00c853] transition"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#00c853] hover:bg-[#00a844] text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isSignUp ? "Create Account" : "Sign In to Dashboard"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-[#e2e8f0] text-center">
              <p className="text-sm text-[#64748b]">
                {isSignUp ? "Already have an account?" : "Don't have an account yet?"}{" "}
                <button
                  onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
                  className="text-[#00c853] font-semibold hover:underline cursor-pointer"
                >
                  {isSignUp ? "Sign In" : "Create One"}
                </button>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-[#94a3b8] mt-6">
            © 2026 Madrasa Manager.
          </p>
        </div>
      </div>
    </div>
  );
}
