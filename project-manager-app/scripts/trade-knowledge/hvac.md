# HVAC Work — SEMSE Trade Knowledge Guide

## Trade: hvac
## Visibility: public_training

---

## SAFETY REQUIREMENTS

1. **Refrigerant handling**: Section 608 EPA certification required to purchase, recover, and handle refrigerants (R-410A, R-22, R-32, R-454B). Venting refrigerant is illegal and subject to fines up to $44,539/day per violation.
2. **Gas line safety**: Always check for gas leaks with a combustible gas detector before lighting pilot lights or starting equipment after any gas work.
3. **Electrical lockout**: HVAC units run on 240V. Turn off disconnect at unit AND breaker at panel. Lock both. Verify with meter before touching capacitors (hold charge after power-off — short with insulated screwdriver).
4. **Capacitor discharge**: Capacitors in condensers and air handlers can hold lethal voltage (300–450V) for minutes after power off. Short them with a resistive discharge tool before handling.
5. **Confined space**: Attics and crawl spaces can reach dangerous temperatures (130°F+) and may have low oxygen. Limit work time, hydrate, have a partner.
6. **CO monitoring**: After any gas furnace work or startup, test for CO at supply registers and near unit. Maximum safe level: 35 PPM. Evacuate if >200 PPM detected.

---

## CODE COMPLIANCE CHECKPOINTS

### Equipment Sizing (Manual J)
- HVAC equipment must be sized per Manual J (ACCA) load calculation — not by rule-of-thumb "tons per square foot."
- Oversized equipment: short-cycles, doesn't dehumidify properly, increases wear.
- Undersized: runs continuously, can't maintain setpoint on design days.
- Design temperature: use ASHRAE 99% heating and 1% cooling values for local climate.

### Duct Design (Manual D)
- Duct systems must be designed per Manual D — proper size for airflow (CFM per room).
- Total External Static Pressure (TESP) must not exceed equipment rated ESP.
- Minimum duct insulation: R-8 in unconditioned spaces (attic, crawl space, garage).
- All duct joints must be sealed with mastic compound or UL-listed metal tape (NOT standard duct tape — degrades quickly).
- Duct penetrations through fire-rated assemblies require fire dampers.

### Refrigerant and Equipment
- R-22 (Freon): no longer manufactured; existing systems can use reclaimed R-22. Cannot add virgin R-22 to leaking systems without repair.
- R-410A: current standard for residential. Being phased down under AIM Act — being replaced by R-32 and R-454B (Puron Advance).
- SEER2 minimum: 14.3 SEER2 (most of US effective Jan 2023). Some regions higher.
- Gas furnace minimum: 80% AFUE. High-efficiency: 90%+ AFUE condensing furnaces.

### Combustion Air and Venting
- 80% furnaces (B-vent): require dedicated combustion air openings — one near floor, one near ceiling.
- 90%+ condensing furnaces: use PVC intake and exhaust. No chimney required.
- Exhaust PVC: must slope back toward furnace to drain condensate. No sags.
- Horizontal exhaust: must terminate at least 1 foot from windows/doors, 6 inches above grade.
- Upward-terminating PVC: must be at least 12 inches above roofline.
- Combustion air opening sizing: 1 sq inch free area per 1000 BTU/hr of total appliance input.

### Condensate Drainage
- Primary drain: minimum 3/4" PVC, slope 1/4" per foot to drain.
- Secondary drain: required for attic installations. Must terminate where visible (over a window) to alert occupant of primary failure.
- P-trap required on condensate drain — prevents air bypass and drain pan overflow.
- Condensate pump: test float switch before closing up equipment.

---

## COMMON PROCEDURES

### Charging a Refrigerant System (R-410A)
1. Confirm all power off. Recover existing refrigerant if system is contaminated or being replaced.
2. Evacuate system with vacuum pump to 500 microns (let sit 30 min — if rises above 500 microns, there is a leak or moisture present).
3. Weigh in refrigerant charge: manufacturer specifies weight, plus add-back for line set length (per manufacturer table, typically 0.6 oz per ft of 3/8" liquid line over 15 ft).
4. Verify with superheat method (TXV systems) or subcooling method (fixed orifice systems).
5. Target superheat: 10–20°F (varies by OAT and return air temp — use manufacturer charging chart).
6. Target subcooling: 8–14°F (varies — use manufacturer spec).
7. Record pressures, temps, and refrigerant weight on service record.

### Replacing a Furnace
1. Shut off gas and electrical. Confirm gas off with soap bubbles at union.
2. Disconnect flue, gas line, electrical wiring, and duct connections.
3. Remove old furnace.
4. Install new furnace: level, connect supply and return plenums.
5. Gas connection: use flexible corrugated connector (18" max) or hard pipe with union. Apply CSST or gas-rated Teflon tape on male threads only (NPT threads).
6. Leak test all gas connections: 10 PSI for 15 min (new pipe) or soap bubble test all joints.
7. Reconnect electrical: wiring diagram on furnace. 24V control wiring to thermostat.
8. Reconnect venting: slope PVC correctly, ensure all joints glued and supported.
9. Commission: start furnace, verify ignition, measure supply/return temperature split (should be 35–55°F). Check CO at supply registers.

### Replacing a Condenser (Outdoor Unit)
1. Recover refrigerant from old system.
2. Disconnect electrical, refrigerant lines, and unbolt unit from pad.
3. Install new unit: level on pad, adequate clearance (18" sides, 24" front, 48" top).
4. Braze new line set connections or use quick-connect fittings (must be approved type).
5. Pressure test: 150 PSI nitrogen, hold 30 min.
6. Evacuate to 500 microns.
7. Charge per manufacturer spec.
8. Start system, verify proper operation.

### Commissioning (Startup) Checklist
- [ ] Filter installed (correct size, correct direction — arrow points toward blower).
- [ ] All registers and grilles installed and open.
- [ ] Thermostat wiring correct and thermostat programmed.
- [ ] System powers on and calls for heating/cooling as expected.
- [ ] Air handler blower starts without unusual noise.
- [ ] Condenser fan and compressor start (cooling).
- [ ] Temperature split across coil: heating 35–55°F; cooling 16–22°F.
- [ ] Static pressure within equipment rating (test with magnehelic gauge at coil and blower).
- [ ] Condensate drain flows freely — pour water in pan to confirm.
- [ ] Gas pressure verified at furnace manifold (typically 3.5" WC for natural gas; 10" WC for propane).
- [ ] CO reading: 0 PPM at supply registers in heating mode.
- [ ] System cycles off at setpoint and doesn't short-cycle.

---

## INSPECTION CHECKPOINTS

### Rough-In (before drywall or insulation)
- [ ] All duct work installed, supported, and sealed (mastic on all joints).
- [ ] Duct insulation installed in unconditioned spaces.
- [ ] Flue pipe supported and sloped correctly.
- [ ] Combustion air openings sized and installed.
- [ ] Condensate drain with P-trap installed and sloped.
- [ ] Secondary drain pan installed for attic units.
- [ ] Permit posted.

### Final Inspection
- [ ] Equipment installed, operational, and commissioned.
- [ ] Refrigerant charge verified.
- [ ] CO test passed.
- [ ] Gas leak test passed.
- [ ] Static pressure within spec.
- [ ] Temperature split within spec.
- [ ] All duct work balanced (airflow to each room per Manual D design).
- [ ] Condensate drainage verified functional.
- [ ] Equipment label and data plate visible.

---

## EVIDENCE REQUIRED FOR APPROVAL

- Photo: manufacturer data plate on new equipment.
- Photo: refrigerant charge data (gauge set readings, weight charged in).
- Photo: condensate drain including P-trap and secondary drain.
- Photo: CO meter reading at supply register (showing 0 PPM or within limits).
- Photo: gas leak test (gauge or soap bubbles at connections).
- Photo: permit and inspection card.

---

## COMMON MISTAKES TO AVOID

1. **Duct tape on ducts**: Standard cloth duct tape dries out and fails within 5 years in an attic. Use mastic or UL-listed foil tape.
2. **Oversized equipment**: "Bigger is better" is wrong in HVAC. Oversized AC won't dehumidify; oversized furnace causes short cycling.
3. **Refrigerant overcharge**: Too much refrigerant is as bad as too little. Always charge by weight + verify with subcooling/superheat.
4. **No P-trap on condensate**: Without a P-trap, blower draws air through drain, causing drain pan to overflow onto ceiling.
5. **PVC exhaust sloping wrong**: Condensing furnace exhaust must slope down toward furnace. Sags pool condensate and cause furnace lockout.
6. **Unsealed duct connections**: Leaky ducts in unconditioned space can lose 20–30% of system capacity. Seal everything.
7. **Skipping Manual J**: Guessing on equipment size leads to poor comfort, callbacks, and warranty issues.
8. **Low refrigerant not repaired**: Topping off a leaking system without repairing the leak is an EPA violation and wastes money.

---

## TROUBLESHOOTING GUIDE

### System not cooling adequately
- Check filter (dirty filter = low airflow = frozen evaporator coil).
- Check refrigerant charge (superheat/subcooling out of range).
- Check for ice on indoor coil (low airflow or low charge).
- Verify condenser is clean (power wash fins annually).
- Verify outdoor temperature vs. system capacity (most residential systems rated to 95°F OAT).

### Furnace won't start
- Check thermostat calling for heat (set 5° above current temp).
- Check filter (dirty filter triggers high-limit switch).
- Check for error codes on control board (LED flash sequence).
- Check inducer motor starting (listen for it to energize before igniter).
- Check igniter glow or spark.
- Check flame sensor (clean with steel wool — coated sensors cause false flame-out).

### High static pressure symptoms
- Airflow noisy, high velocity at registers.
- Short cycling.
- Compressor overheating.
- Duct joints leaking.
- Solution: measure TESP with manometer; redesign duct or open registers.

### Short cycling (AC)
- Oversized unit — turns on, reaches setpoint too fast, turns off, repeats.
- Check low refrigerant (below minimum suction pressure = low-pressure cutout).
- Dirty condenser coil (high head pressure cutout).
