import { NextResponse } from "next/server";

// Define types based on the backend
interface Table {
  id?: string;
  players?: string[];
  gameState?: any;
}

// This is a proxy to the backend server
const API_URL = process.env.API_URL || "http://localhost:8080";

export async function GET() {
  try {
    const response = await fetch(`${API_URL}/table`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch tables" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching tables:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(`${API_URL}/table/createTable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to create table" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creating table:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
