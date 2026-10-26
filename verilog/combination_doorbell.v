// ============================================================================
// Module: combination_doorbell
// Description: Electronic Combination Doorbell FSM (B1 -> B2 -> B3)
// Course: R25DER302 : Digital Electronics
// Department: Computer Science and Engineering
// College: Christ College of Engineering (Autonomous), Irinjalakuda
// ============================================================================
`timescale 1ns / 1ps

module combination_doorbell(
    input  wire clk,     // System Clock
    input  wire rst,     // Synchronous Active-High Reset
    input  wire b1,      // Button 1 (First digit of combination)
    input  wire b2,      // Button 2 (Second digit of combination)
    input  wire b3,      // Button 3 (Third digit of combination)
    output wire bell     // Doorbell Chime Output (High only in UNLOCK state)
);

    // 2-Bit State Encoding
    localparam [1:0] IDLE   = 2'b00, // Waiting for first button (b1). Bell OFF.
                     S1     = 2'b01, // b1 was correct; waiting for b2.
                     S2     = 2'b10, // b1 and b2 were correct; waiting for b3.
                     UNLOCK = 2'b11; // Combination accepted. Bell ON for 1 clock cycle.

    // State Registers
    reg [1:0] state;
    reg [1:0] next_state;

    // 01: State Register (Sequential Logic)
    always @(posedge clk) begin
        if (rst) begin
            state <= IDLE;
        end else begin
            state <= next_state;
        end
    end

    // 02: Next-State Logic (Combinational Logic)
    always @(*) begin
        next_state = state; // Default: hold state if no button pressed
        case (state)
            IDLE: begin
                // Waiting for B1
                if (b1)
                    next_state = S1;
                else
                    next_state = IDLE;
            end

            S1: begin
                // Waiting for B2
                if (b2)
                    next_state = S2;
                else if (b1 || b3)
                    next_state = IDLE; // Wrong input resets to IDLE
                else
                    next_state = S1;   // Hold state until button press
            end

            S2: begin
                // Waiting for B3
                if (b3)
                    next_state = UNLOCK;
                else if (b1 || b2)
                    next_state = IDLE; // Wrong input resets to IDLE
                else
                    next_state = S2;   // Hold state until button press
            end

            UNLOCK: begin
                // Bell rings for exactly one clock cycle, then auto-returns to IDLE
                next_state = IDLE;
            end

            default: begin
                next_state = IDLE;
            end
        endcase
    end

    // 03: Output Logic (Moore Output)
    // Bell = 1 only when state is UNLOCK (2'b11), i.e., Q1 & Q0
    assign bell = (state == UNLOCK);

endmodule
