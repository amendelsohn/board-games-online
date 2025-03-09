"use client";

import Image from "next/image";
import React from "react";

interface GameCardProps {
  id: string;
  name: string;
  description: string;
  image: string;
  players: string;
  difficulty: "easy" | "medium" | "hard";
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function GameCard({
  id,
  name,
  description,
  image,
  players,
  difficulty,
  onClick,
  isLoading = false,
  disabled = false,
}: GameCardProps) {
  // Set badge color based on difficulty
  const difficultyColor = {
    easy: "badge-success",
    medium: "badge-warning",
    hard: "badge-error",
  }[difficulty];

  return (
    <div className="card bg-base-100 shadow-md hover:shadow-lg transition-all">
      <figure className="px-6 pt-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-[120px] w-[120px]">
            <span className="loading loading-spinner loading-md text-primary"></span>
          </div>
        ) : (
          <Image
            src={image}
            alt={name}
            width={120}
            height={120}
            className="rounded-xl"
          />
        )}
      </figure>

      <div className="card-body">
        <h2 className="card-title">
          {name}
          <div className={`badge ${difficultyColor} badge-sm`}>
            {difficulty}
          </div>
        </h2>

        <p className="text-sm">{description}</p>

        <div className="flex items-center mt-2 text-sm text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="w-4 h-4 mr-1 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span>{players}</span>
        </div>

        <div className="card-actions justify-end mt-4">
          <button
            className="btn btn-primary btn-sm"
            onClick={onClick}
            disabled={disabled || isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-xs"></span>
                Creating...
              </>
            ) : (
              "Play Now"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
