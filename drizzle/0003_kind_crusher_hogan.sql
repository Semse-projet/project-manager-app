CREATE TABLE `encrypted_vault` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`category` varchar(100) DEFAULT 'general',
	`encrypted_data` text NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `encrypted_vault_id` PRIMARY KEY(`id`)
);
