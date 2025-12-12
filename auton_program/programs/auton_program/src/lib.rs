use anchor_lang::prelude::*;

// This is the program's on-chain ID.
// It will be replaced with the real Program ID after deployment.
declare_id!("9Dpgf1nWom5Psp6vwLs1J6WF7dVbySQwk8HhLSqXx62n");
// CONSTANTS
const MAX_PLATFORM_FEE_BPS: u64 = 10000; // Max 100% fee (10000 basis points)

#[program]
pub mod auton_program {
    use super::*;

    // Initialize the protocol's global configuration
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        initial_fee_percentage: u64,
    ) -> Result<()> {
        require!(
            initial_fee_percentage <= MAX_PLATFORM_FEE_BPS,
            CustomError::InvalidFeePercentage
        );

        let config = &mut ctx.accounts.protocol_config;
        config.admin_wallet = *ctx.accounts.admin.key;
        config.fee_percentage = initial_fee_percentage;
        Ok(())
    }

    // Update the protocol's global configuration
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_admin_wallet: Option<Pubkey>,
        new_fee_percentage: Option<u64>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;

        // Only the current admin can update
        require!(
            config.admin_wallet == *ctx.accounts.admin.key,
            CustomError::Unauthorized
        );

        if let Some(admin_wallet) = new_admin_wallet {
            config.admin_wallet = admin_wallet;
        }
        if let Some(fee_percentage) = new_fee_percentage {
            require!(fee_percentage <= MAX_PLATFORM_FEE_BPS, CustomError::InvalidFeePercentage);
            config.fee_percentage = fee_percentage;
        }
        Ok(())
    }

    // NEW: Registers a username for a creator
    // This creates a PDA that maps a username to a wallet address
    pub fn register_username(ctx: Context<RegisterUsername>, username: String) -> Result<()> {
        // Validate username
        require!(username.len() >= 3 && username.len() <= 32, CustomError::InvalidUsername);
        require!(
            username.chars().all(|c| c.is_alphanumeric() || c == '_'),
            CustomError::InvalidUsername
        );

        let username_account = &mut ctx.accounts.username_account;
        username_account.authority = *ctx.accounts.creator.key;
        username_account.username = username;

        Ok(())
    }

    // Initializes a new account for a creator to hold their content list.
    // This only needs to be called once per creator.
    pub fn initialize_creator(ctx: Context<InitializeCreator>) -> Result<()> {
        let creator_account = &mut ctx.accounts.creator_account;
        creator_account.creator_wallet = *ctx.accounts.creator.key;
        creator_account.content = Vec::new();
        creator_account.last_content_id = 0;
        Ok(())
    }

    // Adds a new piece of content to the creator's account.
    pub fn add_content(
        ctx: Context<AddContent>,
        title: String,
        price: u64,
        encrypted_cid: Vec<u8>,
    ) -> Result<()> {
        let creator_account = &mut ctx.accounts.creator_account;
        
        require!(creator_account.creator_wallet == *ctx.accounts.creator.key, CustomError::Unauthorized);

        // Increment the counter to get a new ID
        creator_account.last_content_id += 1;
        let new_id = creator_account.last_content_id;

        let new_content = ContentItem {
            id: new_id,
            title,
            price,
            encrypted_cid,
        };

        creator_account.content.push(new_content);
        Ok(())
    }

    // Records that a user has paid for a specific piece of content.
    // This transfers SOL from buyer to creator (minus fee) and admin (fee), then creates an access receipt.
    pub fn process_payment(ctx: Context<ProcessPayment>, content_id: u64) -> Result<()> {
        let creator_account = &ctx.accounts.creator_account;
        let config = &ctx.accounts.protocol_config;

        // Find the content item by its ID. This is much more efficient than hashing.
        let content_item = creator_account.content.iter().find(|item| {
            item.id == content_id
        }).ok_or(CustomError::ContentNotFound)?;

        let total_price = content_item.price;
        let fee_amount = (total_price * config.fee_percentage) / 10000; // 10000 = 100% in basis points
        let creator_amount = total_price - fee_amount;

        // 1. Transfer Platform Fee to Admin Wallet
        if fee_amount > 0 {
            let fee_transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.admin_wallet.key(), // Use admin wallet from config
                fee_amount,
            );
            anchor_lang::solana_program::program::invoke(
                &fee_transfer_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.admin_wallet.to_account_info(), // Passed in account
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }
        
        msg!("Collected {} lamports in platform fees", fee_amount);


        // 2. Transfer Remaining Amount to Creator's Wallet
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.creator_wallet.key(),
            creator_amount,
        );
        
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.creator_wallet.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Create the access receipt
        let access_account = &mut ctx.accounts.paid_access_account;
        access_account.buyer = *ctx.accounts.buyer.key;
        access_account.content_id = content_id;
        
        msg!("Payment processed: {} lamports (fee: {}, creator: {})", 
             total_price, fee_amount, creator_amount);
        
        Ok(())
    }
}

// 1. ACCOUNTS (State)
// These structs define the shape of the data we store on-chain.

// Global configuration for the protocol (admin wallet, fee percentage)
#[account]
pub struct ProtocolConfig {
    pub admin_wallet: Pubkey,
    pub fee_percentage: u64, // Basis points (e.g., 500 = 5%)
}

// NEW: Username registry entry - maps username to wallet address
#[account]
pub struct UsernameAccount {
    pub authority: Pubkey,  // The creator's wallet address
    pub username: String,   // The username itself
}

#[account]
pub struct CreatorAccount {
    pub creator_wallet: Pubkey,
    pub last_content_id: u64, // Counter for generating unique content IDs
    pub content: Vec<ContentItem>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ContentItem {
    pub id: u64, // Unique ID for the content
    pub title: String,
    pub price: u64, // Price in lamports
    pub encrypted_cid: Vec<u8>, // Encrypted IPFS CID (ciphertext + nonce + auth tag)
}

#[account]
pub struct PaidAccessAccount {
    pub buyer: Pubkey,
    pub content_id: u64, // ID of the content this receipt grants access to
}


// 2. INSTRUCTION CONTEXTS
// These structs define the accounts required by each instruction.
// Anchor uses this to validate that the correct accounts are passed in.

// Context for initializing the protocol config
#[derive(Accounts)]
#[instruction(initial_fee_percentage: u64)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8, // discriminator + admin_wallet pubkey + fee_percentage u64
        seeds = [b"config"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// Context for updating the protocol config
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,
    #[account(mut)]
    pub admin: Signer<'info>, // Only current admin can sign
}

// NEW: Context for registering a username
#[derive(Accounts)]
#[instruction(username: String)]
pub struct RegisterUsername<'info> {
    // The PDA account for the username registry entry.
    // Seeds include the username, ensuring each username can only be claimed once.
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 4 + username.len(), // discriminator + pubkey + string length + username
        seeds = [b"username", username.as_bytes()],
        bump
    )]
    pub username_account: Account<'info, UsernameAccount>,

    // The creator claiming the username
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeCreator<'info> {
    // The PDA account for the creator's content list.
    // `init` means this instruction will create the account.
    // `payer = creator` means the creator will pay for the account's rent.
    // `space` is the initial space allocation. 8 for the discriminator, 32 for the pubkey, 4 for the vector prefix.
    // We will need to reallocate more space later when content is added.
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 8 + 4, // discriminator + wallet + counter + vec prefix
        seeds = [b"creator", creator.key().as_ref()],
        bump
    )]
    pub creator_account: Account<'info, CreatorAccount>,
    
    // The creator, who must sign the transaction.
    #[account(mut)]
    pub creator: Signer<'info>,
    
    // The system program, required by Solana to create accounts.
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddContent<'info> {
    // The creator's content list account. It must be mutable to add content.
    // `realloc` will increase the account's size to fit the new content.
    // `realloc::payer` specifies who pays for the extra rent.
    // `realloc::zero` ensures the new memory is zeroed out.
    #[account(
        mut,
        seeds = [b"creator", creator.key().as_ref()],
        bump,
        // Approximate: id(8) + title(128) + price(8) + encrypted_cid(100)
        realloc = 8 + 32 + 8 + 4 + (creator_account.content.len() + 1) * (8 + 4 + 128 + 8 + 4 + 100), 
        realloc::payer = creator,
        realloc::zero = true
    )]
    pub creator_account: Account<'info, CreatorAccount>,

    // The creator, who must sign.
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(content_id: u64)]
pub struct ProcessPayment<'info> {
    // The PDA "receipt" account.
    // The seeds ensure that a user can only have one receipt per content item.
    #[account(
        init,
        payer = buyer,
        space = 8 + 32 + 8, // discriminator + buyer pubkey + content_id
        seeds = [b"access", buyer.key().as_ref(), &content_id.to_le_bytes()],
        bump
    )]
    pub paid_access_account: Account<'info, PaidAccessAccount>,

    // The protocol's global configuration account
    #[account(seeds = [b"config"], bump)]
    pub protocol_config: Account<'info, ProtocolConfig>,

    // The creator's account, used to verify the payment destination and price.
    #[account(mut)]
    pub creator_account: Account<'info, CreatorAccount>,

    // The creator's wallet, derived from the creator_account.
    // The `address` constraint is a key security feature: it ensures the client
    // passes the correct wallet address that is stored in the creator_account.
    /// CHECK: This is the creator's wallet address, validated by the address constraint.
    #[account(mut, address = creator_account.creator_wallet)]
    pub creator_wallet: AccountInfo<'info>,

    // The admin wallet that receives the platform fee.
    // Its address is validated against the protocol_config.
    /// CHECK: This is the admin wallet address, validated by the address constraint.
    #[account(mut, address = protocol_config.admin_wallet)]
    pub admin_wallet: AccountInfo<'info>,

    // The user who is paying.
    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}


// 3. ERRORS
// Custom errors for our program.

#[error_code]
pub enum CustomError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("The specified content was not found in the creator's account.")]
    ContentNotFound,

    #[msg("Invalid username. Must be 3-32 characters, alphanumeric or underscore only.")]
    InvalidUsername,
    #[msg("Invalid fee percentage. Must be <= 10000 (100%).")]
    InvalidFeePercentage,
}