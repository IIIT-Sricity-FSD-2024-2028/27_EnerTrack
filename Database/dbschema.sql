1.Core Location Tables:-


CREATE TABLE Campus(campus_id INT PRIMARY KEY,campus_name VARCHAR(100),city VARCHAR(100));

CREATE TABLE Building(building_id INT PRIMARY KEY,campus_id INT,building_name VARCHAR(100),code VARCHAR(50),
FOREIGN KEY(campus_id)REFERENCES Campus(campus_id));

CREATE TABLE Department(department_id INT PRIMARY KEY,campus_id INT,building_id INT,department_name VARCHAR(100),
FOREIGN KEY(campus_id)REFERENCES Campus(campus_id),
FOREIGN KEY(building_id)REFERENCES Building(building_id));




2.Meter & Readings:-


CREATE TABLE Meter_Type(type_id INT PRIMARY KEY,type_name VARCHAR(50),resource_type VARCHAR(50),unit_default VARCHAR(20));

CREATE TABLE Meter(meter_id INT PRIMARY KEY,meter_code VARCHAR(50),department_id INT,building_id INT,campus_id INT,type_id INT,status VARCHAR(20),
FOREIGN KEY(department_id)REFERENCES Department(department_id),
FOREIGN KEY(building_id)REFERENCES Building(building_id),
FOREIGN KEY(campus_id)REFERENCES Campus(campus_id),
FOREIGN KEY(type_id)REFERENCES Meter_Type(type_id));

CREATE TABLE Meter_Readings(reading_id INT PRIMARY KEY,meter_id INT,timestamp DATETIME,value DECIMAL(10,2),interval_min INT,status VARCHAR(20),
FOREIGN KEY(meter_id)REFERENCES Meter(meter_id));




3.Cost & Utility Rates:-


CREATE TABLE Utility_Rate(rate_id INT PRIMARY KEY,rate_per_kwh DECIMAL(10,4),valid_from DATE,campus_id INT,valid_to DATE,currency VARCHAR(10),
FOREIGN KEY(campus_id)REFERENCES Campus(campus_id));

CREATE TABLE Cost_Run(cost_run_id INT PRIMARY KEY,rate_id INT,building_id INT,department_id INT,campus_id INT,user_id INT,period_start DATE,period_end DATE,created_at DATETIME,rate_per_kwh DECIMAL(10,4),
FOREIGN KEY(rate_id)REFERENCES Utility_Rate(rate_id),
FOREIGN KEY(building_id)REFERENCES Building(building_id),
FOREIGN KEY(department_id)REFERENCES Department(department_id),
FOREIGN KEY(campus_id)REFERENCES Campus(campus_id));

CREATE TABLE Cost_Result(cost_result_id INT PRIMARY KEY,cost_run_id INT,total_cost DECIMAL(12,2),total_kwh DECIMAL(12,2),
FOREIGN KEY(cost_run_id)REFERENCES Cost_Run(cost_run_id));





4.Carbon Tracking:-


CREATE TABLE Emission_Factor(factor_id INT PRIMARY KEY,region VARCHAR(100),year INT,kgco2_per_kwh DECIMAL(10,5));

CREATE TABLE Carbon_Run(carbon_run_id INT PRIMARY KEY,factor_id INT,user_id INT,building_id INT,department_id INT,campus_id INT,start_at DATE,end_at DATE,
FOREIGN KEY(factor_id)REFERENCES Emission_Factor(factor_id),
FOREIGN KEY(building_id)REFERENCES Building(building_id),
FOREIGN KEY(department_id)REFERENCES Department(department_id),
FOREIGN KEY(campus_id)REFERENCES Campus(campus_id));

CREATE TABLE Carbon_Result(carbon_result_id INT PRIMARY KEY,carbon_run_id INT,total_kwh DECIMAL(12,2),total_kgco2 DECIMAL(12,2),
FOREIGN KEY(carbon_run_id)REFERENCES Carbon_Run(carbon_run_id));




5.Alerts & Faults:-


CREATE TABLE Alert(alert_id INT PRIMARY KEY,meter_id INT,user_id INT,severity VARCHAR(20),message TEXT,created_at DATETIME,status VARCHAR(20),resolved_at DATETIME,
FOREIGN KEY(meter_id)REFERENCES Meter(meter_id));

CREATE TABLE Fault(fault_id INT PRIMARY KEY,alert_id INT,user_id INT,fault_type VARCHAR(50),is_false_alarm BOOLEAN,severity VARCHAR(20),description TEXT,confirmed_at DATETIME,
FOREIGN KEY(alert_id)REFERENCES Alert(alert_id));




6.Work Orders & Supplies:-



CREATE TABLE Work_Order(work_order_id INT PRIMARY KEY,fault_id INT,user_id INT,status VARCHAR(20),notes TEXT,created_at DATETIME,closed_at DATETIME,
FOREIGN KEY (fault_id) REFERENCES Fault(fault_id));

CREATE TABLE Suppliers(parts_id INT PRIMARY KEY,availability BOOLEAN,category VARCHAR(50),supply_name VARCHAR(100));

CREATE TABLE Work_Order_Supplies(work_order_id INT,parts_id INT,quantity INT,
PRIMARY KEY(work_order_id, parts_id),
FOREIGN KEY(work_order_id)REFERENCES Work_Order(work_order_id),
FOREIGN KEY(parts_id)REFERENCES Suppliers(parts_id));




7.Users & Roles:-


CREATE TABLE Role(role_id INT PRIMARY KEY,permission_json TEXT,role_name VARCHAR(50));

CREATE TABLE User(user_id INT PRIMARY KEY,password VARCHAR(255),email VARCHAR(100),user_name VARCHAR(100),role_id INT,
FOREIGN KEY(role_id)REFERENCES Role(role_id));



8.Reports:-


CREATE TABLE Report(report_id INT PRIMARY KEY,request_id INT,file_path VARCHAR(255),generated_at DATETIME);

CREATE TABLE Report_Request(request_id INT PRIMARY KEY,user_id INT,building_id INT,department_id INT,campus_id INT,report_type VARCHAR(50),start_at DATE,end_at DATE,filters_json TEXT,
status VARCHAR(20),report_format VARCHAR(20),created_at DATETIME,
FOREIGN KEY(building_id)REFERENCES Building(building_id),
FOREIGN KEY(department_id)REFERENCES Department(department_id),
FOREIGN KEY(campus_id)REFERENCES Campus(campus_id));



9.Sustainability Initiatives:-


CREATE TABLE Sustainable_Initiative(initiative_id INT PRIMARY KEY,title VARCHAR(100),initiative_type VARCHAR(50),target_kwh DECIMAL(12,2),start_date DATE,baseline_start DATE,baseline_end DATE,end_date DATE,status VARCHAR(20),user_id INT,campus_id INT,department_id INT,building_id INT,post_initiative_kwh DECIMAL(12,2),baseline_kwh DECIMAL(12,2),
FOREIGN KEY(user_id)REFERENCES User(user_id),
FOREIGN KEY(campus_id)REFERENCES Campus(campus_id),
FOREIGN KEY(department_id)REFERENCES Department(department_id),
FOREIGN KEY(building_id)REFERENCES Building(building_id));





// There was only Database Object like Alerts in the Above sql code and for Remaining Objects Such as Triggers,Stored Procedures,Stored Functions are given below.//


1.TRIGGER – Auto-create Alert from Meter Readings:-
  
DELIMITER $$
CREATE TRIGGER trg_high_reading_alert 
AFTER INSERT ON Meter_Readings
FOR EACH ROW
BEGIN
DECLARE threshold_val DECIMAL(10,2);
SET threshold_val=1000;
IF NEW.value>threshold_val THEN
INSERT INTO Alert(alert_id,meter_id,severity,message,created_at,status)
VALUES(NULL,NEW.meter_id,'HIGH','Meter reading exceeded threshold',NOW(),'OPEN');
END IF;
END$$
DELIMITER ;




2.STORED FUNCTION – Calculate Total Energy:-
s
DELIMITER $$
CREATE FUNCTION Get_Total_kWh(p_meter_id INT)
RETURNS DECIMAL(12,2)
DETERMINISTIC
BEGIN
DECLARE total_kwh DECIMAL(12,2);
SELECT SUM(value)
INTO total_kwh
FROM Meter_Readings
WHERE meter_id=p_meter_id;
RETURN IFNULL(total_kwh,0);
END$$
DELIMITER ;




3.STORED FUNCTION – Calculate Cost:-

DELIMITER $$
CREATE FUNCTION Get_Cost(p_kwh DECIMAL(12,2),p_rate DECIMAL(10,4))
RETURNS DECIMAL(12,2)
DETERMINISTIC
BEGIN
RETURN p_kwh*p_rate;
END$$
DELIMITER ;



4.STORED FUNCTION – Carbon Emission:-

DELIMITER $$
CREATE FUNCTION Get_CO2(p_kwh DECIMAL(12,2),p_factor DECIMAL(10,5))
RETURNS DECIMAL(12,2)
DETERMINISTIC
BEGIN
RETURN p_kwh*p_factor;
END$$
DELIMITER ;


5.STORED PROCEDURE – Cost Calculation:-

DELIMITER $$
CREATE PROCEDURE Calculate_Cost(
IN p_meter_id INT,
IN p_rate DECIMAL(10,4))
BEGIN
DECLARE total_kwh DECIMAL(12,2);
DECLARE total_cost DECIMAL(12,2);
//Get total energy
SET total_kwh=Get_Total_kWh(p_meter_id);
//Calculate cost
SET total_cost=Get_Cost(total_kwh,p_rate);
//Store result
INSERT INTO Cost_Result(cost_result_id,cost_run_id,total_cost,total_kwh)
VALUES(NULL,NULL,total_cost,total_kwh);
END$$
DELIMITER ;


6.STORED PROCEDURE – Carbon Calculation:-

DELIMITER $$
CREATE PROCEDURE Calculate_Carbon(IN p_meter_id INT,IN p_factor DECIMAL(10,5))
BEGIN
DECLARE total_kwh DECIMAL(12,2);
DECLARE total_co2 DECIMAL(12,2);
SET total_kwh=Get_Total_kWh(p_meter_id);
SET total_co2=Get_CO2(total_kwh,p_factor);
INSERT INTO Carbon_Result(carbon_result_id,carbon_run_id,total_kwh,total_kgco2)
VALUES(NULL,NULL,total_kwh,total_co2);
END$$
DELIMITER ;



7.OPTIONAL - Trigger for Fault Creation:-


DELIMITER $$
CREATE TRIGGER trg_alert_to_fault
AFTER INSERT ON Alert
FOR EACH ROW
BEGIN
IF NEW.severity='HIGH' THEN
INSERT INTO Fault(fault_id,alert_id,fault_type,severity,description,confirmed_at)
VALUES(NULL,NEW.alert_id,'Auto-detected','HIGH','Fault generated from high alert',NOW());
END IF;
END$$
DELIMITER ;


//Triggers are used to automatically generate alerts when meter readings exceed predefined thresholds and to convert critical alerts into faults. Stored functions are implemented for reusable computations such as total energy consumption, cost calculation, and carbon emission estimation. Stored procedures are used to encapsulate business logic for cost and carbon calculations, ensuring modularity and reusability. These additions improve automation, maintainability, and efficiency of the system.//


