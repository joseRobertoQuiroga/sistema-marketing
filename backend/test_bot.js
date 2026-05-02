const axios = require('axios');

async function testBot() {
    console.log('🧪 Iniciando Prueba de Bot...');
    
    const testCases = [
        { type: 'text', text: '¿Dónde están ubicados?', conversationId: 'test-1' },
        { type: 'text', text: '¿Qué precio tiene el vestido rojo?', conversationId: 'test-1' },
        { type: 'text', text: '¿Aceptan tarjeta?', conversationId: 'test-2' }
    ];

    for (const test of testCases) {
        console.log(`\n-----------------------------------`);
        console.log(`👤 Usuario: ${test.text}`);
        
        try {
            // Simulamos el webhook enviando al endpoint local
            const response = await axios.post('http://localhost:3000/webhook', {
                type: test.type,
                text: test.text,
                conversationId: test.conversationId
            }, {
                headers: { 'x-org-id': '00000000-0000-0000-0000-000000000000' } // ID de la Org de prueba
            });

            console.log(`🤖 Bot (Status): ${response.data.message}`);
            
            // Esperamos un momento para que el worker procese (en una prueba real veríamos el log del backend)
            console.log(`⏳ Procesando en background... revisa los logs de Docker para ver la respuesta de Mistral.`);
        } catch (error) {
            console.error(`❌ Error en prueba: ${error.message}`);
        }
    }
}

testBot();
