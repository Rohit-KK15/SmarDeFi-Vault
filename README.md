# SmarDeFi Vault

An AI-Powered DeFi Vault managed by AI Agents created using ADK-TS by IQAI. This project combines a secure smart contract vault, a modern Next.js frontend, and intelligent agents to optimize DeFi strategies.

## 📂 Repository Structure

This is a monorepo containing the following packages:

- **`packages/contracts`**: Hardhat project containing the smart contracts for the vault and strategies.
- **`packages/frontend`**: Next.js web application for users to interact with the vault.
- **`packages/agents`**: AI agents built with ADK-TS that monitor and manage the vault strategies.

## 🧠 Powered by ADK-TS (Agent Development Kit)

This project is a showcase of the **ADK-TS (Agent Development Kit)** by IQAI, demonstrating how to build complex, autonomous DeFi agents using TypeScript.

**How ADK-TS Powers SmarDeFi:**

1.  **Conversation Orchestration Layer**:
    *   **Session Memory**: Handles conversation memory for the session.
    *   **Tool Management**: Manages structured tool response formatting and guides the agent to use tools correctly.
    *   **Frontend Simplicity**: Reduces frontend logic complexity as the agent handles user interaction.

2.  **TypeScript Integration**:
    *   **Developer Experience**: Tools, agent logic, and types are all written in TypeScript, making it developer-friendly and strongly typed.
    *   **Seamless Integration**: Easy to integrate with the Next.js/React frontend.

3.  **Context State Management**: Built-in state management for storing context, such as caching the latest APY updates.

4.  **Modular Architecture**: Uses `AgentBuilder` to orchestrate specialized agents (`StrategySentinel`, `YieldSimulator`) for distinct responsibilities.

---

## 🤖 AI Agent System

The vault is managed by a team of specialized AI agents:

### 1. Strategy Sentinel Agent 🛡️
**Role**: Guardian & Portfolio Manager
- **Responsibilities**:
    - Continuously monitors strategy health (LTV, Liquidation Risk).
    - Fetches real-time token prices (LINK/WETH) to make market-aware decisions.
    - **Risk Management**: Automatically pauses strategies or reduces leverage during high volatility.
    - **Rebalancing**: Adjusts portfolio weights between safe and leveraged strategies based on market conditions.
    - **Harvesting**: Collects yields and compounds them back into the vault.

### 2. Chat Agent 💬
**Role**: User Assistant
- **Responsibilities**:
    - Provides a natural language interface for users to interact with the vault.
    - Checks user balances and vault statistics securely.
    - Facilitates deposits and withdrawals via chat commands.
    - **Privacy**: Strictly enforces security boundaries, ensuring it never exposes admin functions or other users' data.

### 3. Yield Simulator Agent 📈
**Role**: Yield Generator
- **Responsibilities**:
    - Simulates yield accrual scenarios for testing and demonstration purposes.
    - Helps validate the vault's profit distribution logic.

---

## 🏦 Vault Strategies

The SmarDeFi Vault allocates user funds into multiple strategies to maximize yield while managing risk:

### 1. Aave V3 Strategy (Safe)
- **Description**: A low-risk strategy that supplies assets (e.g., USDC, LINK) to the Aave V3 lending pool.
- **Mechanism**: Earns passive supply APY from the lending market.
- **Risk Profile**: Low. Principal is protected, subject only to smart contract risk.

### 2. Aave Leverage Strategy (Aggressive)
- **Description**: A high-yield strategy that uses looping to leverage the supply position.
- **Mechanism**:
    1. Supplies LINK to Aave.
    2. Borrows WETH against the LINK collateral.
    3. Swaps borrowed WETH for more LINK.
    4. Resupplies the LINK.
    5. Repeats this process up to `maxDepth` times (configurable).
- **Risk Profile**: High. Vulnerable to liquidation if the collateral value drops significantly relative to the debt.
- **AI Management**: The **Strategy Sentinel Agent** actively manages this risk by monitoring the LTV and auto-deleveraging if it approaches dangerous levels.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (Package manager)
- [MetaMask](https://metamask.io/) or another Web3 wallet

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd defi-portfolio
    ```

2.  Install dependencies for all packages:
    ```bash
    pnpm install
    ```

## 🛠️ Running the Project

To run the full stack, you need to start the blockchain (or deploy to testnet), run the agent server, and start the frontend.

### 1. Smart Contracts (`packages/contracts`)

Navigate to the contracts directory:
```bash
cd packages/contracts
```

- **Compile contracts**:
  ```bash
  npx hardhat compile
  ```

- **Run local node**:
  ```bash
  npx hardhat node
  ```

- **Deploy contracts**:
  ```bash
  npx hardhat ignition deploy ./ignition/modules/Lock.ts --network localhost
  ```
  *(Note: Update the deployment script path as necessary based on your specific modules)*

### 2. AI Agents (`packages/agents/defi-portfolio`)

Navigate to the agent directory:
```bash
cd packages/agents/defi-portfolio
```

- **Setup Environment**:
  Copy `.env.example` to `.env` and configure your keys.
  ```bash
  cp .env.example .env
  ```

- **Run Agent Server**:
  ```bash
  pnpm dev:server
  ```

- **Run Automation Cron**:
  ```bash
  pnpm automate:cron
  ```

### 3. Frontend (`packages/frontend`)

Navigate to the frontend directory:
```bash
cd packages/frontend
```

- **Setup Environment**:
  Create a `.env.local` file with the deployed contract addresses.
  ```bash
  cp .env.example .env.local
  ```
  *Update `NEXT_PUBLIC_VAULT_ADDRESS` and other variables with addresses from the contract deployment step.*

- **Start Development Server**:
  ```bash
  pnpm dev
  ```

- Open [http://localhost:3000](http://localhost:3000) in your browser.

## 💻 Tech Stack

- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin, Uniswap V3
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Wagmi, Viem
- **AI Agents**: ADK-TS (Agent Development Kit), Node.js, Express

## 📄 License

[ISC](LICENSE)
