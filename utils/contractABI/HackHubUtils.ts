// Interface for HackHubUtils library functions
export interface IHackHubUtils {
  getSlice: (source: string[], startIndex: bigint, endIndex: bigint) => Promise<string[]>;
  removeFromArray: (arr: string[], item: string) => Promise<void>;
  moveItem: (from: string[], to: string[], item: string) => Promise<void>;
}

// ABI for HackHubUtils library
export const HackHubUtilsABI = [
  {
    type: "function",
    name: "getSlice",
    inputs: [
      { name: "source", type: "address[]", internalType: "address[]" },
      { name: "startIndex", type: "uint256", internalType: "uint256" },
      { name: "endIndex", type: "uint256", internalType: "uint256" }
    ],
    outputs: [{ name: "", type: "address[]", internalType: "address[]" }],
    stateMutability: "view"
  },
  {
    type: "function", 
    name: "removeFromArray",
    inputs: [
      { name: "arr", type: "address[]", internalType: "address[]" },
      { name: "item", type: "address", internalType: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "moveItem", 
    inputs: [
      { name: "from", type: "address[]", internalType: "address[]" },
      { name: "to", type: "address[]", internalType: "address[]" },
      { name: "item", type: "address", internalType: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "error",
    name: "InvalidIndexRange",
    inputs: []
  },
  {
    type: "error", 
    name: "EndIndexOutOfBounds",
    inputs: []
  }
] as const;

// Error types for HackHubUtils
export interface InvalidIndexRangeError {
  name: "InvalidIndexRange";
}

export interface EndIndexOutOfBoundsError {
  name: "EndIndexOutOfBounds";
}

export type HackHubUtilsError = InvalidIndexRangeError | EndIndexOutOfBoundsError;

// Utility functions for working with arrays in frontend
export class HackHubUtilsHelper {
  /**
   * Creates a slice of an array from startIndex to endIndex (inclusive)
   * Client-side implementation that mirrors the contract logic
   */
  static getSlice<T>(source: T[], startIndex: number, endIndex: number): T[] {
    if (startIndex > endIndex) {
      throw new Error("InvalidIndexRange");
    }
    if (endIndex >= source.length) {
      throw new Error("EndIndexOutOfBounds");
    }
    
    return source.slice(startIndex, endIndex + 1);
  }

  /**
   * Removes an item from an array
   * Client-side implementation that mirrors the contract logic
   */
  static removeFromArray<T>(arr: T[], item: T): T[] {
    const result = [...arr];
    const index = result.indexOf(item);
    if (index > -1) {
      result.splice(index, 1);
    }
    return result;
  }

  /**
   * Moves an item from one array to another
   * Client-side implementation that mirrors the contract logic
   */
  static moveItem<T>(from: T[], to: T[], item: T): { from: T[], to: T[] } {
    const newFrom = this.removeFromArray(from, item);
    const newTo = [...to, item];
    return { from: newFrom, to: newTo };
  }
}

// Type definitions
export type AddressArray = string[];
export type IndexRange = {
  startIndex: bigint;
  endIndex: bigint;
};
