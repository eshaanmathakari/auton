use anchor_lang::prelude::*;


// This is the program's on-chain ID.
// It will be replaced with the real Program ID after deployment.
declare_id!("9Dpgf1nWom5Psp6vwLs1J6WF7dVbySQwk8HhLSqXx62n");

#[program]
pub mod auton_program {
    use super::*;

    // Initializes a new account for a creator to hold their content list.
    // This only needs to be called once per creator.
    pub fn initialize_creator(ctx: Context<InitializeCreator>) -> Result<()> {
        let creator_account = &mut ctx.accounts.creator_account;
        creator_account.creator_wallet = *ctx.accounts.creator.key;
        creator_account.content = Vec::new();
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
        
        // Security check: Ensure the signer is the owner of the account.
        require!(creator_account.creator_wallet == *ctx.accounts.creator.key, CustomError::Unauthorized);

        let new_content = ContentItem {
            title,
            price,
            encrypted_cid,
        };

        creator_account.content.push(new_content);
        Ok(())
    }

    // Records that a user has paid for a specific piece of content.
    // This transfers SOL from buyer to creator and creates an access receipt.
    pub fn process_payment(ctx: Context<ProcessPayment>, content_hash: [u8; 32]) -> Result<()> {
        let creator_account = &ctx.accounts.creator_account;

        // Find the content item and its price by hashing and comparing.
        // Note: This linear scan can become expensive if a creator has many content items.
        // For a production system, a more efficient lookup method (like a hash map on-chain
        // or passing a content index) would be a good optimization.
        let content_item = creator_account.content.iter().find(|item| {
            anchor_lang::solana_program::hash::hash(&item.encrypted_cid).to_bytes() == content_hash
        }).ok_or(CustomError::ContentNotFound)?;

        let amount_to_pay = content_item.price;

        // Transfer SOL from buyer to creator's wallet
        let transfer_instruction = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.buyer.key(),
            &ctx.accounts.creator_wallet.key(), // Use the verified wallet from the creator_account
            amount_to_pay,
        );
        
        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.creator_wallet.to_account_info(), // Use the verified wallet
            ],
        )?;

        // Create the access receipt
        let access_account = &mut ctx.accounts.paid_access_account;
        access_account.buyer = *ctx.accounts.buyer.key;
        access_account.content_hash = content_hash;
        Ok(())
    }
}

// 1. ACCOUNTS (State)
// These structs define the shape of the data we store on-chain.

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
        space = 8 + 32 + 4,
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
        realloc = 8 + 32 + 4 + (creator_account.content.len() + 1) * (4 + 128 + 8 + 4 + 100), // Approximate: title(128) + price(8) + encrypted_cid(100)
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
#[instruction(content_hash: [u8; 32])]
pub struct ProcessPayment<'info> {
    // The PDA "receipt" account.
    // The seeds ensure that a user can only have one receipt per content item.
    #[account(
        init,
        payer = buyer,
        space = 8 + 32 + 32, // discriminator + buyer pubkey + content_hash
        seeds = [b"access", buyer.key().as_ref(), &content_hash],
        bump
    )]
    pub paid_access_account: Account<'info, PaidAccessAccount>,

    // The creator's account, used to verify the payment destination and price.
    #[account(mut)]
    pub creator_account: Account<'info, CreatorAccount>,

    // The creator's wallet, derived from the creator_account.
    // The `address` constraint is a key security feature: it ensures the client
    // passes the correct wallet address that is stored in the creator_account.
    /// CHECK: This is the creator's wallet address, validated by the address constraint.
    #[account(mut, address = creator_account.creator_wallet)]
    pub creator_wallet: AccountInfo<'info>,

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
}