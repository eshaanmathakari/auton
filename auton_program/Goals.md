Goal of this program is:

- allow content creators to lock up content behind paywall/tips like Pateron but onchain solana friendly
- content is accessed using the new x402 protocol 
- content creators access the frontend with a metmask/phantom wallet which will be used to sign their tx 
- they can add new content and specify how much SOL to unlock this content for users
- on unlock the IPFS hash is released when payment is received which then front-end will retrieve the content from IPFS
- users can access content using creator ID for example /creators/[someID]
- the backend will query the solana program to fetch available content for this creator and display title/price etc (public free viewable data)
- then if users are interested they have to do x402 to access content
- when uploading content we check if the creator exists if not we init a creator and start saving to it
