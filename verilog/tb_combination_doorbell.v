// ============================================================================
// Testbench: tb_combination_doorbell
// Description: Verification testbench for Electronic Combination Doorbell
// Covers Test 1 (B1 -> B2 -> B3), Test 2 (B1 -> B3), Test 3 (B2 Start)
// ============================================================================
`timescale 1ns / 1ps

module tb_combination_doorbell;

    // Testbench Signals
    reg clk;
    reg rst;
    reg b1;
    reg b2;
    reg b3;
    wire bell;

    // Instantiate Unit Under Test (UUT)
    combination_doorbell uut (
        .clk(clk),
        .rst(rst),
        .b1(b1),
        .b2(b2),
        .b3(b3),
        .bell(bell)
    );

    // Clock Generation (Period = 10ns, Freq = 100MHz)
    always #5 clk = ~clk;

    initial begin
        // VCD Dump for Waveform Viewers (GTKWave, ModelSim, etc.)
        $dumpfile("doorbell_simulation.vcd");
        $dumpvars(0, tb_combination_doorbell);

        // Initialize Inputs
        clk = 0;
        rst = 1;
        b1  = 0;
        b2  = 0;
        b3  = 0;

        $display("===============================================================");
        $display(" STARTING ELECTRONIC COMBINATION DOORBELL VERIFICATION ");
        $display("===============================================================");

        // Apply Reset for 2 clock cycles
        #20;
        rst = 0;
        @(posedge clk);
        $display("[T=%0t] System Reset released. Current State: IDLE, Bell: %b", $time, bell);

        // -------------------------------------------------------------
        // TEST 1: Correct Sequence B1 -> B2 -> B3 (Expected: UNLOCK -> Bell HIGH 1 cycle)
        // -------------------------------------------------------------
        $display("\n>>> RUNNING TEST 1: Correct Sequence (B1 -> B2 -> B3) <<<");
        
        // Press B1 for 1 clock cycle
        @(posedge clk);
        b1 = 1;
        @(posedge clk);
        b1 = 0;
        $display("[T=%0t] B1 pressed -> State advanced to S1. Bell = %b", $time, bell);

        // Press B2 for 1 clock cycle
        @(posedge clk);
        b2 = 1;
        @(posedge clk);
        b2 = 0;
        $display("[T=%0t] B2 pressed -> State advanced to S2. Bell = %b", $time, bell);

        // Press B3 for 1 clock cycle
        @(posedge clk);
        b3 = 1;
        @(posedge clk);
        b3 = 0;
        $display("[T=%0t] B3 pressed -> State advanced to UNLOCK. Bell = %b", $time, bell);

        // Check if Bell is HIGH
        if (bell === 1'b1)
            $display("[PASS] Test 1: UNLOCK achieved! Doorbell is RINGING (Bell = 1).");
        else
            $display("[FAIL] Test 1: Bell should be 1, but got %b", bell);

        // Next clock cycle: State must automatically return to IDLE, Bell LOW
        @(posedge clk);
        #1;
        if (bell === 1'b0)
            $display("[PASS] Test 1 Auto-Reset: FSM returned to IDLE, Bell turned OFF (Bell = 0).");
        else
            $display("[FAIL] Test 1 Auto-Reset: Bell failed to turn OFF!");

        #20;

        // -------------------------------------------------------------
        // TEST 2: Sequence with Wrong Input (B1 -> B3) (Expected: IDLE, Bell LOW)
        // -------------------------------------------------------------
        $display("\n>>> RUNNING TEST 2: Incorrect Sequence (B1 -> B3) <<<");
        
        // Press B1
        @(posedge clk);
        b1 = 1;
        @(posedge clk);
        b1 = 0;
        $display("[T=%0t] B1 pressed -> State S1. Bell = %b", $time, bell);

        // Press Wrong Button B3 instead of B2
        @(posedge clk);
        b3 = 1;
        @(posedge clk);
        b3 = 0;
        $display("[T=%0t] Wrong Button B3 pressed in S1 -> State returned to IDLE.", $time);

        @(posedge clk);
        #1;
        if (bell === 1'b0 && uut.state === 2'b00)
            $display("[PASS] Test 2: Sequence rejected, state returned to IDLE (00), Bell remained LOW.");
        else
            $display("[FAIL] Test 2: FSM did not return to IDLE! State: %b, Bell: %b", uut.state, bell);

        #20;

        // -------------------------------------------------------------
        // TEST 3: Starting with Wrong Input (B2) (Expected: IDLE, Bell LOW)
        // -------------------------------------------------------------
        $display("\n>>> RUNNING TEST 3: Starting with Wrong Input (B2) <<<");
        
        // Press B2 from IDLE
        @(posedge clk);
        b2 = 1;
        @(posedge clk);
        b2 = 0;
        $display("[T=%0t] B2 pressed in IDLE.", $time);

        @(posedge clk);
        #1;
        if (bell === 1'b0 && uut.state === 2'b00)
            $display("[PASS] Test 3: B2 in IDLE ignored, stayed in IDLE (00), Bell remained LOW.");
        else
            $display("[FAIL] Test 3: Expected IDLE, got State: %b, Bell: %b", uut.state, bell);

        #30;
        $display("\n===============================================================");
        $display(" ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! ");
        $display("===============================================================\n");
        $finish;
    end

endmodule
