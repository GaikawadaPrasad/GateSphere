"use client";

import React from "react";
import Link from "next/link";
import PublicLayout from "@/components/public/PublicLayout";

export default function NotFound() {
  return (
    <PublicLayout>
      <div className="min-h-[75vh] flex items-center justify-center px-6 py-24 bg-[#090E1A] text-white">
        <div className="max-w-lg w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 text-blue-400 font-mono text-2xl font-bold mb-6">
            404
          </div>
          <h1
            className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Page Not Found
          </h1>
          <p
            className="text-slate-400 text-sm sm:text-base leading-relaxed mb-8"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            The page you are looking for doesn&apos;t exist or has been moved. Explore our main
            platform navigation below.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:opacity-95 transition-all"
            >
              Return to Home →
            </Link>
            <Link
              href="/platform"
              className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white font-semibold text-sm transition-all"
            >
              Explore Platform
            </Link>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-800/80 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
            <Link href="/solutions" className="hover:text-blue-400 transition">
              Solutions
            </Link>
            <span>•</span>
            <Link href="/features" className="hover:text-blue-400 transition">
              Features
            </Link>
            <span>•</span>
            <Link href="/security" className="hover:text-blue-400 transition">
              Security
            </Link>
            <span>•</span>
            <Link href="/about" className="hover:text-blue-400 transition">
              About
            </Link>
            <span>•</span>
            <Link href="/demo" className="hover:text-blue-400 transition">
              Book Demo
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
