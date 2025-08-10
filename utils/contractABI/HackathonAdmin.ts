// ABI for HackathonAdmin library
export const HACKATHON_ADMIN_ABI = [
  {
    "type": "error",
    "name": "OnlyOngoingHackathons",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OnlyHackathonContract",
    "inputs": []
  },
  {
    "type": "event",
    "name": "ParticipantRegistered",
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "hackathon",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "participant",
        "type": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "JudgeRegistered",
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "hackathon",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "judge",
        "type": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "HackathonConcluded",
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "hackathon",
        "type": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "function",
    "name": "registerParticipant",
    "inputs": [
      {
        "internalType": "mapping(address => bool)",
        "name": "isOngoing",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "participantOngoing",
        "type": "mapping"
      },
      {
        "internalType": "address",
        "name": "participant",
        "type": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "external"
  },
  {
    "type": "function",
    "name": "registerJudge",
    "inputs": [
      {
        "internalType": "mapping(address => bool)",
        "name": "isOngoing",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "judgeOngoing",
        "type": "mapping"
      },
      {
        "internalType": "address",
        "name": "judge",
        "type": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "external"
  },
  {
    "type": "function",
    "name": "getUserCounts",
    "inputs": [
      {
        "internalType": "mapping(address => address[])",
        "name": "participantOngoing",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "participantPast",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "judgeOngoing",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "judgePast",
        "type": "mapping"
      },
      {
        "internalType": "address",
        "name": "user",
        "type": "address"
      }
    ],
    "outputs": [
      {
        "internalType": "uint256",
        "name": "participantOngoingCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "participantPastCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "judgeOngoingCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "judgePastCount",
        "type": "uint256"
      }
    ],
    "stateMutability": "external"
  },
  {
    "type": "function",
    "name": "concludeHackathon",
    "inputs": [
      {
        "internalType": "address[]",
        "name": "ongoingHackathons",
        "type": "address[]"
      },
      {
        "internalType": "address[]",
        "name": "pastHackathons",
        "type": "address[]"
      },
      {
        "internalType": "mapping(address => bool)",
        "name": "isOngoing",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "participantOngoing",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "participantPast",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "judgeOngoing",
        "type": "mapping"
      },
      {
        "internalType": "mapping(address => address[])",
        "name": "judgePast",
        "type": "mapping"
      },
      {
        "internalType": "address",
        "name": "hackathon",
        "type": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "external"
  }
] as const;

// TypeScript interfaces for HackathonAdmin
export interface IHackathonAdmin {
  registerParticipant: (
    isOngoing: Record<string, boolean>,
    participantOngoing: Record<string, string[]>,
    participant: string
  ) => Promise<void>;
  
  registerJudge: (
    isOngoing: Record<string, boolean>,
    judgeOngoing: Record<string, string[]>,
    judge: string
  ) => Promise<void>;
  
  getUserCounts: (
    participantOngoing: Record<string, string[]>,
    participantPast: Record<string, string[]>,
    judgeOngoing: Record<string, string[]>,
    judgePast: Record<string, string[]>,
    user: string
  ) => Promise<{
    participantOngoingCount: bigint;
    participantPastCount: bigint;
    judgeOngoingCount: bigint;
    judgePastCount: bigint;
  }>;
  
  concludeHackathon: (
    ongoingHackathons: string[],
    pastHackathons: string[],
    isOngoing: Record<string, boolean>,
    participantOngoing: Record<string, string[]>,
    participantPast: Record<string, string[]>,
    judgeOngoing: Record<string, string[]>,
    judgePast: Record<string, string[]>,
    hackathon: string
  ) => Promise<void>;
}

// Error types
export interface OnlyOngoingHackathonsError {
  name: "OnlyOngoingHackathons";
}

export interface OnlyHackathonContractError {
  name: "OnlyHackathonContract";
}

export type HackathonAdminError = OnlyOngoingHackathonsError | OnlyHackathonContractError;

// Event types
export interface ParticipantRegisteredEvent {
  hackathon: string;
  participant: string;
}

export interface JudgeRegisteredEvent {
  hackathon: string;
  judge: string;
}

export interface HackathonConcludedEvent {
  hackathon: string;
}

// User counts return type
export interface UserCounts {
  participantOngoingCount: bigint;
  participantPastCount: bigint;
  judgeOngoingCount: bigint;
  judgePastCount: bigint;
}
