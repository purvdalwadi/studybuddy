import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

export default function SignUp() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    university: "",
    major: "",
    year: ""
  });
  const [localError, setLocalError] = useState("");
  const { register, loading, error } = useAuth();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");
    if (form.password !== form.confirm) {
      setLocalError("Passwords do not match");
      return;
    }
    await register({
      name: form.name,
      email: form.email,
      password: form.password,
      university: form.university,
      major: form.major,
      year: form.year
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        className="bg-white dark:bg-gray-900 shadow-xl rounded-xl p-8 w-full max-w-md space-y-6"
        onSubmit={handleSubmit}
      >
        <h2 className="text-2xl font-bold mb-2 text-center">Sign Up for StudyBuddy</h2>
        {(localError || error) && (
          <div className="text-red-600 text-sm mb-2">
            {Array.isArray(error?.errors)
              ? (
                  <ul className="list-disc ml-5">
                    {error.errors.map((err, i) => <li key={i}>{err.msg || err.message || String(err)}</li>)}
                  </ul>
                )
              : (localError || (typeof error === 'string' ? error : JSON.stringify(error)))}
          </div>
        )}
        <div>
          <label className="block mb-1 font-medium">Name</label>
          <Input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="Your Name"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Email</label>
          <Input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="you@email.com"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Password</label>
          <Input
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Confirm Password</label>
          <Input
            type="password"
            name="confirm"
            value={form.confirm}
            onChange={handleChange}
            required
            placeholder="••••••••"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">University</label>
          <Input
            type="text"
            name="university"
            value={form.university}
            onChange={handleChange}
            required
            placeholder="Your University"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Major</label>
          <Input
            type="text"
            name="major"
            value={form.major}
            onChange={handleChange}
            required
            placeholder="Your Major"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Year</label>
          <select
            name="year"
            value={form.year}
            onChange={handleChange}
            required
            className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="" disabled>Select Academic Year</option>
            <option value="Freshman">Freshman</option>
            <option value="Sophomore">Sophomore</option>
            <option value="Junior">Junior</option>
            <option value="Senior">Senior</option>
            <option value="Graduate">Graduate</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <Button type="submit" className="w-full mt-2" disabled={loading}>
          {loading ? "Signing Up..." : "Sign Up"}
        </Button>
        <div className="flex justify-between mt-2 text-sm">
          <a href="/signin" className="text-indigo-600 hover:underline">Sign In</a>
        </div>
      </form>
    </div>
  );
}
