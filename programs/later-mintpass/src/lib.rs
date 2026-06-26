use anchor_lang::prelude::*;
use mpl_core::{
    instructions::{CreateCollectionV2CpiBuilder, CreateV2CpiBuilder},
    types::{Plugin, PluginAuthority, PluginAuthorityPair},
};

declare_id!("11111111111111111111111111111111111111111");

const MAX_SUPPLY: u64 = 200;

#[program]
pub mod later_mintpass {
    use super::*;

    // Se ejecuta UNA sola vez: crea la colección y la cuenta de control
    pub fn initialize_collection(ctx: Context<InitializeCollection>, name: String, uri: String) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.collection = ctx.accounts.collection.key();
        config.minted_count = 0;
        config.max_supply = MAX_SUPPLY;

        CreateCollectionV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .collection(&ctx.accounts.collection)
            .update_authority(Some(&ctx.accounts.authority))
            .payer(&ctx.accounts.authority)
            .system_program(&ctx.accounts.system_program)
            .name(name)
            .uri(uri)
            .invoke()?;

        Ok(())
    }

    // Mint individual gratuito a una wallet ganadora — solo el authority puede llamarlo
    pub fn mint_pass(ctx: Context<MintPass>, name: String, uri: String) -> Result<()> {
        let config = &mut ctx.accounts.config;

        require!(config.minted_count < config.max_supply, MintPassError::SupplyExhausted);

        CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program)
            .asset(&ctx.accounts.asset)
            .collection(Some(&ctx.accounts.collection))
            .authority(Some(&ctx.accounts.authority))
            .payer(&ctx.accounts.authority)
            .owner(Some(&ctx.accounts.recipient))
            .update_authority(Some(&ctx.accounts.authority))
            .system_program(&ctx.accounts.system_program)
            .name(name)
            .uri(uri)
            .plugins(vec![PluginAuthorityPair {
                plugin: Plugin::PermanentBurnDelegate(mpl_core::types::PermanentBurnDelegate {}),
                authority: Some(PluginAuthority::UpdateAuthority),
            }])
            .invoke()?;

        config.minted_count += 1;

        Ok(())
    }
}

#[account]
pub struct MintPassConfig {
    pub authority: Pubkey,
    pub collection: Pubkey,
    pub minted_count: u64,
    pub max_supply: u64,
}

#[derive(Accounts)]
pub struct InitializeCollection<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 32 + 8 + 8, seeds = [b"config"], bump)]
    pub config: Account<'info, MintPassConfig>,
    #[account(mut)]
    pub collection: Signer<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: validado por el programa de Metaplex Core
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintPass<'info> {
    #[account(mut, seeds = [b"config"], bump, has_one = authority, has_one = collection)]
    pub config: Account<'info, MintPassConfig>,
    #[account(mut)]
    pub asset: Signer<'info>,
    /// CHECK: la colección ya creada en initialize_collection
    #[account(mut)]
    pub collection: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: wallet del usuario ganador, solo recibe el NFT
    pub recipient: UncheckedAccount<'info>,
    /// CHECK: validado por el programa de Metaplex Core
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum MintPassError {
    #[msg("Se alcanzó el límite de 200 Mint Pass")]
    SupplyExhausted,
}