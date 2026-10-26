# Microproject Technical Documentation: Electronic Combination Doorbell

**Course**: R25DER302 — Digital Electronics  
**Department**: Computer Science and Engineering  
**Institution**: Christ College of Engineering (Autonomous), Irinjalakuda  

---

## 1. Executive Summary

This project implements a complete, end-to-end design and verification of an **Electronic Combination Doorbell** based on a synchronous 4-state Finite State Machine (FSM). The access sequence required to ring the bell is **`B1 → B2 → B3`**.

```
[IDLE (00)] ──B1=1──> [S1 (01)] ──B2=1──> [S2 (10)] ──B3=1──> [UNLOCK (11)]
    ▲                    │                    │                      │
    │                    │ (wrong input)      │ (wrong input)        │ (auto-return)
    └────────────────────┴────────────────────┴──────────────────────┘
                                                                 BELL = 1 (Ringing)
```

### Key Deliverables:
1. **Interactive Frontend Web Application**: Built using the industrial hardware aesthetic from `door bell/`, featuring:
   - Live hardware simulation chassis with tactile push-buttons (B1, B2, B3)
   - Real-time digital readout of flip-flop state bits ($Q_1, Q_0$) and state badge (`IDLE`, `S1`, `S2`, `UNLOCK`)
   - High-fidelity acoustic chime synthesizer (Web Audio API) and multi-layered red LED dome strobe animation
   - Hardware reset button ($RST=1$) and sound toggle
2. **FSM State Diagram & Transition Table**: Complete mathematical model detailing all state transitions, hold-in-state self-loops, and wrong-button reset transitions.
3. **Logisim 2.7.x Gate-Level Circuit (`electronic_combination_doorbell.circ`)**:
   - Synthesized using pure discrete logic (2 D Flip-Flops, 3-input NOR gate, state decoder AND gates, excitation OR/AND gates, and Moore output AND gate).
   - Tested and verified in browser on **`https://logisim.app/`** with screenshots embedded.
4. **Verilog HDL Implementation**:
   - Synthesizable RTL module (`combination_doorbell.v`)
   - Testbench (`tb_combination_doorbell.v`) covering all 3 test vectors from the PDF specification.

---

## 2. FSM Specification & Boolean Logic Synthesis

### 2.1 State Encoding
The FSM has 4 discrete states requiring $N = \lceil \log_2(4) \rceil = 2$ flip-flops ($Q_1$ as MSB, $Q_0$ as LSB):

| State Name | Binary Code ($Q_1 Q_0$) | Bell Output | Functional Description |
|:---|:---:|:---:|:---|
| **`IDLE`** | `2'b00` | `0` (OFF) | Quiescent state. Waiting strictly for button $B_1$. Out-of-order presses ($B_2, B_3$) leave FSM in `IDLE`. |
| **`S1`** | `2'b01` | `0` (OFF) | First button $B_1$ validated. Waiting strictly for $B_2$. Pressing $B_1$ or $B_3$ resets FSM to `IDLE`. |
| **`S2`** | `2'b10` | `0` (OFF) | First two buttons ($B_1, B_2$) validated. Waiting strictly for $B_3$. Pressing $B_1$ or $B_2$ resets FSM to `IDLE`. |
| **`UNLOCK`** | `2'b11` | `1` (HIGH ★) | Access sequence accepted! Bell output is asserted HIGH for exactly one clock cycle, then automatically returns to `IDLE`. |

### 2.2 Synthesized Boolean Equations

1. **NOR-based Inactivity Signal**:
   $$\text{no\_btn} = \overline{B_1 + B_2 + B_3}$$

2. **State Decoder**:
   $$w_{\text{IDLE}} = \overline{Q_1} \cdot \overline{Q_0}$$
   $$w_{S1} = \overline{Q_1} \cdot Q_0$$
   $$w_{S2} = Q_1 \cdot \overline{Q_0}$$
   $$w_{\text{UNLOCK}} = Q_1 \cdot Q_0$$

3. **D Flip-Flop Next-State Excitation Logic**:
   $$D_1 = \overline{RST} \cdot \left[ (w_{S1} \cdot B_2) + (w_{S2} \cdot B_3) + (w_{S2} \cdot \text{no\_btn}) \right]$$
   $$D_0 = \overline{RST} \cdot \left[ (w_{\text{IDLE}} \cdot B_1) + (w_{S1} \cdot \text{no\_btn}) + (w_{S2} \cdot B_3) \right]$$

4. **Moore Output Logic**:
   $$\text{BELL} = w_{\text{UNLOCK}} = Q_1 \cdot Q_0$$

---

## 3. Logisim Circuit Architecture

The circuit file **`electronic_combination_doorbell.circ`** implements this exact architecture:
- **5 Input Pins**: $B_1$, $B_2$, $B_3$, $CLK$ (Clock), and $RST$ (Synchronous Reset)
- **NOR Gate**: 3-input gate generating $\text{no\_btn}$
- **Decoder Section**: 4 AND gates producing one-hot wires for each of the 4 states
- **Excitation Logic**: Two 3-input OR gates feeding into active-low reset gating AND gates
- **Memory Section**: Two positive-edge-triggered D Flip-Flops storing state bits $Q_1$ and $Q_0$
- **Moore Output**: High-drive Bell pin and green indicator LED asserted when $Q_1 = Q_0 = 1$
- **Diagnostic LEDs**: Color-coded state indicators:
  - Green LED: `STATE 00 (IDLE)`
  - Yellow LED: `STATE 01 (S1)`
  - Orange LED: `STATE 10 (S2)`
  - Cyan LED: `STATE 11 (UNLOCK)`

---

## 4. Verilog HDL Implementation

### 4.1 Synthesizable RTL Module (`combination_doorbell.v`)
```verilog
`timescale 1ns / 1ps

module combination_doorbell(
    input  wire clk,      // System Clock
    input  wire rst,      // Active-High Synchronous Reset
    input  wire b1, b2, b3, // Push Buttons
    output wire bell      // Doorbell Ring Output
);

    localparam [1:0] IDLE   = 2'b00,
                     S1     = 2'b01,
                     S2     = 2'b10,
                     UNLOCK = 2'b11;

    reg [1:0] state, next_state;

    // 01: Sequential State Register
    always @(posedge clk) begin
        if (rst)
            state <= IDLE;
        else
            state <= next_state;
    end

    // 02: Combinational Next-State Logic
    always @(*) begin
        next_state = state;
        case (state)
            IDLE:   next_state = b1 ? S1 : IDLE;
            S1:     if (b2)        next_state = S2;
                    else if (b1 || b3) next_state = IDLE;
            S2:     if (b3)        next_state = UNLOCK;
                    else if (b1 || b2) next_state = IDLE;
            UNLOCK: next_state = IDLE;
            default: next_state = IDLE;
        endcase
    end

    // 03: Moore Bell Output
    assign bell = (state == UNLOCK);

endmodule
```

### 4.2 Automated Testbench Verification
Three verification vectors were tested against the RTL model and netlist:
- **Test 1 (`B1 → B2 → B3`)**: Transitions $\text{IDLE} \to S1 \to S2 \to \text{UNLOCK}$. Bell asserted $\text{HIGH}$ ($1$) for exactly 1 cycle. **[PASSED]**
- **Test 2 (`B1 → B3`)**: Transitions $\text{IDLE} \to S1 \to \text{IDLE}$. Bell remains $\text{LOW}$ ($0$). Sequence rejected. **[PASSED]**
- **Test 3 (`B2` from IDLE)**: Out-of-order starting button ignored. FSM remains in $\text{IDLE}$ ($00$), Bell remains $\text{LOW}$ ($0$). **[PASSED]**

---

## 5. How to Run Locally

1. **Launch the Web Application**:
   ```powershell
   node server.js
   ```
   Open **`http://localhost:8080/`** in Chrome, Edge, or Firefox.

2. **Test the Doorbell**:
   - Press **B1**, then **B2**, then **B3**.
   - Observe the LCD screen change, the Q1/Q0 bits flip from `00` $\to$ `01` $\to$ `10` $\to$ `11`, the red dome light pulse, and the Westminster chime play.
   - Test pressing **Hardware RST** to verify return to `IDLE`.

3. **Inspect the Circuit in Logisim**:
   - Download `electronic_combination_doorbell.circ` from the website.
   - Open in desktop Logisim 2.7.x or in [logisim.app](https://logisim.app/).
