curl --location 'https://mainnet.sandshrew.io/v1/6e3bc3c289591bb447c116fda149b094' \
--header 'Content-Type: application/json' \
--data '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "btc_decoderawtransaction",
    "params": ["020000000001025bcbce502499b835dcffdfa56e0c7cdba0bdb00848ef019acd62a441c39f06680000000000ffffffff578ad7f2a593f9447a8ef0f790a9b1abfc81a6b2796920db573595a6c24c747a0100000000ffffffff025802000000000000225120b31750cbd2449ea81693d4274d26e8ff97ec24d4dcaadcb60020bb05bdd70e2f19540000000000002251200d89d702fafc100ab8eae890cbaf40b3547d6f1429564cf5d5f8d517f4caa3900140a3eb6eba8cc5f941ead67ee9858117658771acf6a06c7ac63a5f99d8ad5346c5958586b4ef5f27bd07e30302147080f987389eb57e0adbb3ac8a9366c17f5a6401402be69c0759cc8197bcb4f6a8743db958f401f5e594789ab667c7519b16b8fbfec898ae5a60e9d8fa72285f54b0a94c34859f6a6b172c74d4ea9a1c9bcab554ee00000000"]
}' | jq .
