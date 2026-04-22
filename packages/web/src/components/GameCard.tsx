"use client";

import Image from "next/image";
import React, { useState } from "react";

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
  const [isHovering, setIsHovering] = useState(false);

  // Set badge color based on difficulty
  const difficultyColor = {
    easy: "badge-success",
    medium: "badge-warning",
    hard: "badge-error",
  }[difficulty];

  const handleCardClick = () => {
    if (!disabled && !isLoading) {
      onClick();
    }
  };

  return (
    <div
      className={`card bg-base-100 shadow-md hover:shadow-lg transition-all cursor-pointer ${
        disabled || isLoading ? "opacity-70" : "hover:scale-105"
      }`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      role="button"
      aria-disabled={disabled || isLoading}
      tabIndex={disabled || isLoading ? -1 : 0}
    >
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
          {isLoading ? (
            <div className="flex items-center gap-2">
              <span className="loading loading-spinner loading-xs"></span>
              <span>Creating...</span>
            </div>
          ) : (
            <div
              className={`transition-all duration-800 ease-in-out min-w-[90px] h-8 flex items-center justify-center ${
                isHovering
                  ? "btn btn-primary btn-sm animate-pulse"
                  : "badge badge-primary badge-outline text-xs px-3"
              }`}
            >
              Play Now
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
